import { eslint } from 'rollup-plugin-eslint'
import resolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'
import postcss from 'rollup-plugin-postcss'
import replace from 'rollup-plugin-replace'
import { uglify } from 'rollup-plugin-uglify'

const config = require('./config')

const replaceEnv = {
    IS_DEBUG: false,
}
Object.entries(config.prod.env).forEach(([k, v]) => (replaceEnv[`process.env.${k}`] = v))
process.env = {
    ...process.env,
    ...config.prod.env,
}
const buildMode = process.env.BUILD_MODE || 'normal'
const outputConfig = {
    normal: [
        {
            format: 'umd',
            name: 'XMap',
            file: 'build/xmap.js',
            indent: '\t',
        },
        {
            format: 'es',
            file: 'build/xmap.module.js',
            indent: '\t',
        },
    ],
    closure: [
        {
            format: 'umd',
            name: 'XMap',
            file: 'build/xmap.min.js',
            minify: true,
        },
    ],
}

export default {
    input: 'src/index.js',
    output: outputConfig[buildMode],
    plugins: [
        resolve(),
        eslint({
            include: ['src/**/*.js'],
        }),
        postcss({
            extensions: ['.css'],
            minimize: true,
        }),
        buildMode == 'closure' &&
            babel({
                exclude: 'node_modules/**', // 排除node_modules 下的文件
                runtimeHelpers: true,
            }),
        replace(replaceEnv),
        buildMode == 'closure' &&
            uglify({
                warnings: false, // remove warning
                compress: {
                    dead_code: true, //remove dead code
                    pure_funcs: [], // funcs will not pack when build
                    drop_debugger: true,
                    drop_console: true,
                },
                sourcemap: false,
            }),
    ],
}
