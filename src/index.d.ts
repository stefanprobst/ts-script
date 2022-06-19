import type { Plugin } from 'esbuild'

export function createTsConfigPathsPlugin(tsconfigPath?: string, extensions?: string): Plugin
