import { set_css_vars } from 'gpuix-svelte';
import { apply_theme, type Palette } from 'gpuix-svelte-ui';

export type SurfaceTokens = {
	sidebar: string;
	panel: string;
	stage: string;
	selected: string;
};

export const KILO_DARK: Palette = {
	appearance: 'dark',
	bg: '#141415',
	panel: '#18181a',
	raised: '#222225',
	'raised-hover': '#2b2b30',
	border: '#252529',
	'border-strong': '#37373d',
	ink: '#ededef',
	muted: '#8c8c94',
	accent: '#ededef',
	'accent-ink': '#ededef',
	'accent-wash': '#ededef14',
	'on-accent': '#141415',
	success: '#34d399',
	'success-wash': '#34d3991c',
	warning: '#f59e0b',
	'warning-wash': '#f59e0b1c',
	danger: '#f87171',
	'danger-wash': '#f871711c'
};

export const DARK_SURFACES: SurfaceTokens = {
	sidebar: '#111112',
	panel: '#18181a',
	stage: '#141415',
	selected: '#232326'
};

export const KILO_LIGHT: Palette = {
	appearance: 'light',
	bg: '#ffffff',
	panel: '#fafaf9',
	raised: '#f1f1ef',
	'raised-hover': '#e7e7e4',
	border: '#eaeae6',
	'border-strong': '#d5d5cf',
	ink: '#161618',
	muted: '#73737a',
	accent: '#18181b',
	'accent-ink': '#18181b',
	'accent-wash': '#18181b10',
	'on-accent': '#ffffff',
	success: '#15803d',
	'success-wash': '#16a34a16',
	warning: '#b45309',
	'warning-wash': '#d9770618',
	danger: '#dc2626',
	'danger-wash': '#dc262616'
};

export const LIGHT_SURFACES: SurfaceTokens = {
	sidebar: '#f5f5f3',
	panel: '#fafaf9',
	stage: '#ffffff',
	selected: '#ffffff'
};

export function applyAppTheme(dark: boolean): { palette: Palette; surfaces: SurfaceTokens } {
	const palette = dark ? KILO_DARK : KILO_LIGHT;
	const surfaces = dark ? DARK_SURFACES : LIGHT_SURFACES;
	apply_theme(palette);
	set_css_vars({
		'surface-sidebar': surfaces.sidebar,
		'surface-panel': surfaces.panel,
		'surface-stage': surfaces.stage,
		'surface-selected': surfaces.selected,
		'scroller-thumb': dark ? '#34343a' : '#d1d1cc',
		'scroller-thumb-hover': dark ? '#4a4a52' : '#b4b4ae'
	});
	return { palette, surfaces };
}
