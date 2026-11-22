import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get_native, register_font } from 'gpuix-svelte';
import { ensureEmbeddedNatives } from './native-runtime.ts';

export const APP_FONT_FAMILY = 'Allo';

const FONT_FILES = [
	'Allo-Regular.otf',
	'Allo-Medium.otf',
	'Allo-SemiBold.otf',
	'Allo-Bold.otf'
] as const;

const REGISTERED_KEY = Symbol.for('kilo.fonts.registered');

type GlobalFontRegistry = typeof globalThis & {
	[REGISTERED_KEY]?: WeakSet<object>;
};

function getRegisteredHosts(): WeakSet<object> {
	const g = globalThis as GlobalFontRegistry;
	return (g[REGISTERED_KEY] ??= new WeakSet<object>());
}

function resolveFontPath(filename: string): string | null {
	const embeddedRoot = ensureEmbeddedNatives();
	if (embeddedRoot) {
		const embeddedPath = path.join(embeddedRoot, 'fonts', filename);
		if (existsSync(embeddedPath)) return embeddedPath;
	}
	const localPath = fileURLToPath(new URL(`../../assets/fonts/${filename}`, import.meta.url));
	if (existsSync(localPath)) return localPath;
	return null;
}

/** Registers the bundled Allo static OTF weights once per GPUI native instance. */
export function registerAppFonts(): boolean {
	const native = get_native();
	if (!native) return false;

	const registered = getRegisteredHosts();
	if (registered.has(native)) return true;

	let loaded = 0;
	for (const file of FONT_FILES) {
		const fontPath = resolveFontPath(file);
		if (!fontPath) continue;
		try {
			register_font(readFileSync(fontPath));
			loaded++;
		} catch (error) {
			console.warn(`[kilo] failed to register font ${file}:`, error);
		}
	}

	if (loaded > 0) {
		registered.add(native);
		return true;
	}
	return false;
}
