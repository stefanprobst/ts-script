#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { log } from '@stefanprobst/log'
import esbuild from 'esbuild'
import glob from 'fast-glob'
import json5 from 'json5'
import mri from 'mri'

/**
 * @see https://github.com/frankleng/esbuild-ts-paths
 */
function createTsConfigPathsPlugin(tsconfigPath = './tsconfig.json') {
  const { compilerOptions } = json5.parse(
    readFileSync(join(process.cwd(), tsconfigPath), { encoding: 'utf-8' }),
  )

  const keys = Object.keys(compilerOptions.paths)
  const expressions = keys.map((key) => key.replace(/\*$/, '.*'))
  const regexes = expressions.map((exp) => new RegExp(`^${exp}`))
  const filter = new RegExp(`^(${expressions.join('|')})`)
  const dirs = Object.values(compilerOptions.paths).map((dirs) =>
    dirs.map((dir) => join(process.cwd(), compilerOptions.baseUrl, dir)),
  )

  /** @type {import('esbuild').Plugin} */
  const plugin = {
    name: 'esbuild-tsconfig-paths',
    setup(build) {
      build.onResolve({ filter }, (args) => {
        const index = regexes.findIndex((re) => re.test(args.path))
        const key = keys[index]

        const [prefix] = key.split('*', 1)
        const file = args.path.replace(prefix, '')

        for (const dir of dirs[index]) {
          const exp = dir.replace('*', file)
          const [matchedFile] = glob.sync(
            [exp, exp + '.*', exp + '/index.*'],
            { onlyFiles: true, suppressErrors: true }
          )
          if (matchedFile) {
            return { path: matchedFile }
          }
        }

        return { path: args.path }
      })
    },
  }

  return plugin
}

async function run() {
  const { _, tsconfig } = mri(process.argv.slice(2))
  const [entrypoint] = _

  if (entrypoint == null) {
    log.error('No input file path provided.')
    process.exit(0)
  }

  const result = await esbuild.build({
    bundle: true,
    format: 'esm',
    platform: 'node',
    entryPoints: [entrypoint],
    external: ['./node_modules/*'],
    plugins: [createTsConfigPathsPlugin(tsconfig)],
    write: false,
  })

  const [out] = result.outputFiles
  const argv = ['--input-type=module', '-e', out.text]
  spawn('node', argv, { stdio: 'inherit' }).on('exit', process.exit)
}

run()
