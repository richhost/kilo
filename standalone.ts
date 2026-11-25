// The entry `bun build.ts` compiles: a binary carries no source to hot-reload, so it imports
// App.svelte statically and mounts it with `render`. Keep `app` option fields as static strings
// so `gpuix-svelte/build` can extract bundle metadata from AST.
import './src/platform/native-runtime.ts';
import { render } from 'gpuix-svelte';
import App from './App.svelte';
import { prepareLinuxTitlebar } from './src/platform/titlebar.ts';
import {
	getInitialWindowBounds,
	MIN_WINDOW_HEIGHT,
	MIN_WINDOW_WIDTH
} from './src/state/spaces.svelte.ts';

prepareLinuxTitlebar();
const bounds = getInitialWindowBounds();
const isMac = process.platform === 'darwin';

render(App, {
	title: 'Kilo',
	width: bounds.width,
	height: bounds.height,
	minWidth: MIN_WINDOW_WIDTH,
	minHeight: MIN_WINDOW_HEIGHT,
	titlebarTransparent: isMac,
	trafficLightX: isMac ? 16 : undefined,
	trafficLightY: isMac ? 17 : undefined,
	rootStyle: {
		display: 'flex',
		width: '100%',
		height: '100%',
		position: 'relative',
		fontFamily: 'Allo',
		userSelect: 'none'
	},
	app: {
		name: 'Kilo',
		identifier: 'in.cutelabs.kilo',
		icon: './assets/icon.png',
		publisher: 'CuteLabs',
		description: 'Easy to use batch image compression software.',
		update: {
			manifest: 'https://github.com/richhost/kilo/releases/latest/download/update.json'
		}
	}
});
