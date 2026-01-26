// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const commonPlugins = [commonjs(), nodeResolve({ preferBuiltins: true })]

const mainConfig = {
  input: 'src/index.js',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  plugins: commonPlugins
}

const postConfig = {
  input: 'src/post-index.js',
  output: {
    esModule: true,
    file: 'dist/post.js',
    format: 'es',
    sourcemap: true
  },
  plugins: commonPlugins
}

export default [mainConfig, postConfig]
