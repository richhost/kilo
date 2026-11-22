import './src/platform/native-runtime.ts';
import { render_hot } from 'gpuix-svelte';
import {
	getInitialWindowBounds,
	MIN_WINDOW_HEIGHT,
	MIN_WINDOW_WIDTH
} from './src/state/spaces.svelte.ts';

const bounds = getInitialWindowBounds();
const isMac = process.platform === 'darwin';

render_hot(new URL('./App.svelte', import.meta.url), {
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
		fontFamily: 'Allo'
	}
});
