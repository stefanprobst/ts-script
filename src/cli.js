#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { log } from '@stefanprobst/log'
import esbuild from 'esbuild'
import mri from 'mri'
import { createTsConfigPathsPlugin } from './index.js'

async function run() {
  const { _, tsconfig, extensions, external } = mri(process.argv.slice(2))
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
    external: ['./node_modules/*', external],
    plugins: [createTsConfigPathsPlugin(tsconfig, extensions)],
    write: false,
  })

  const [out] = result.outputFiles
  const argv = ['--input-type=module', '-e', out.text]
  spawn('node', argv, { stdio: 'inherit' }).on('exit', process.exit)
}

run()
