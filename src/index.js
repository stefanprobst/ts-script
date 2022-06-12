/**
 * @see https://github.com/frankleng/esbuild-ts-paths
 */

/** @typedef {import('esbuild').Plugin} EsbuildPlugin */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import glob from 'fast-glob'
import json5 from 'json5'

/** @type {(tsconfigPath?: string) => EsbuildPlugin} */
export function createTsConfigPathsPlugin(tsconfigPath = './tsconfig.json') {
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

  /** @type {EsbuildPlugin} */
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
