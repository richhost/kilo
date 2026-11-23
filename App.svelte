<script lang="ts">
	import { on_window_key } from 'gpuix-svelte';
	import { key_of, repeats } from 'gpuix-svelte-ui';
	import { syncTitlebar } from './src/platform/titlebar.ts';
	import { registerAppFonts } from './src/platform/fonts.ts';
	import { compressAgain, openFiles, openFolder } from './src/state/actions.ts';
	import { setWindowBounds, ui } from './src/state/spaces.svelte.ts';
	import Panel from './src/ui/Panel.svelte';
	import Toaster from './src/ui/Toaster.svelte';
	import Sidebar from './src/ui/Sidebar.svelte';
	import Stage from './src/ui/Stage.svelte';
	import { applyAppTheme } from './src/ui/theme.ts';

	registerAppFonts();

	$effect(() => {
		const { palette, surfaces } = applyAppTheme(ui.dark);
		let cancelled = false;
		let tries = 0;
		const paint = async () => {
			if (cancelled) return;
			const ok = await syncTitlebar(ui.dark, surfaces.sidebar, palette.ink, palette.border);
			if (cancelled || ok || ++tries > 30) return;
			setTimeout(() => {
				void paint();
			}, 50);
		};
		void paint();
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		return on_window_key('keydown', (e) => {
			if (repeats(e) || e.modifiers?.alt) return;
			const mod =
				process.platform === 'darwin' ? Boolean(e.modifiers?.cmd) : Boolean(e.modifiers?.ctrl);
			if (!mod) return;

			const key = key_of(e);
			if (key === 'o' && e.modifiers?.shift) {
				e.preventDefault();
				void openFolder();
			} else if (key === 'o') {
				e.preventDefault();
				void openFiles();
			} else if (key === 'enter') {
				e.preventDefault();
				compressAgain();
			}
		});
	});
</script>

<div
	class="app"
	onlayout={(e) => {
		if (e.width && e.height) setWindowBounds(e.width, e.height);
	}}
>
	<div class="body">
		<Sidebar />
		<Panel />
		<Stage />
	</div>
	<Toaster />
</div>

<style>
	:root {
		--surface-sidebar: #111112;
		--surface-panel: #18181a;
		--surface-stage: #141415;
		--surface-selected: #232326;
		--segment-track: #131315;
		--segment-thumb: #2b2b30;
		--segment-thumb-border: #37373d;
	}
	.app {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background-color: var(--surface-stage);
		color: var(--ui-ink);
		font-family: 'Allo';
		user-select: none;
	}
	.body {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
		width: 100%;
		min-height: 0;
		overflow: hidden;
	}
</style>
