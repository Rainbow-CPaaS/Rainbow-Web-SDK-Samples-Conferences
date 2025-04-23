import typescript from "rollup-plugin-typescript2";
import copy from 'rollup-plugin-copy';
import nodeResolve from '@rollup/plugin-node-resolve';

const config = [
    {
        input: './src/index.ts',
        output: {
            file: './dist/index.js',
            format: 'esm',
            sourcemap: 'true'
        },
        plugins: [
            nodeResolve({
                sourcemap: true
            }),
            typescript({
                useTsconfigDeclarationDir: false,
                sourceMap: true
            }),
            copy({
                targets: [{ src: ['./src/index.html', './src/style.css'], dest: './dist' }]
            })
        ]
    }
];

export default config;