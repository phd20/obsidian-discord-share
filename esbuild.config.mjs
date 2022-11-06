import esbuild from "esbuild";
import process from "process";
import builtins from 'builtin-modules'

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === 'production');

esbuild.build({
	banner: {
		js: banner,
	},
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: [
		'obsidian',
		'electron',
		'@codemirror/autocomplete',
		'@codemirror/collab',
		'@codemirror/commands',
		'@codemirror/language',
		'@codemirror/lint',
		'@codemirror/search',
		'@codemirror/state',
		'@codemirror/view',
		'@lezer/common',
		'@lezer/highlight',
		'@lezer/lr',
		'node:buffer',
		'node:process',
		'node:timers',
		'node:path',
		'node:fs/promises',
		'node:events',
		'node:util',
		'node:worker_threads',
		'node:stream',
		'node:fs',
		'node:child_process',
		...builtins],
	format: 'cjs',
	watch: !prod,
	target: 'es2020',
	logLevel: "info",
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: 'main.js',
	minify: true,
}).catch(() => process.exit(1));
