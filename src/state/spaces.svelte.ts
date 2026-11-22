import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Format, Row, Space, WindowBounds } from '../core/types.ts';

export type { Format, Row, Space, WindowBounds };

export const MIN_WINDOW_WIDTH = 960;
export const MIN_WINDOW_HEIGHT = 640;
export const DEFAULT_WINDOW_BOUNDS: WindowBounds = { width: 1180, height: 760 };

type Saved = {
	currentId: string;
	dark: boolean;
	spaces: Space[];
	window?: WindowBounds;
};

const MAX_WINDOW_WIDTH = 7680;
const MAX_WINDOW_HEIGHT = 4320;
const VALID_FORMATS = new Set<Format>(['original', 'jpg', 'png', 'webp', 'avif']);
const PERSIST_DEBOUNCE_MS = 150;
const EXIT_HOOK_KEY = Symbol.for('kilo.state.exit-hook');

const DEFAULT_SPACE: Space = {
	id: 'space_default',
	name: 'Space',
	suffix: '-min',
	format: 'original',
	level: 1,
	originalOutput: true,
	outputDir: '',
	keepExif: false
};

const normalizeDimension = (value: unknown): number | undefined => {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return undefined;
	return Math.floor(value);
};

const normalizeFormat = (value: unknown): Format => {
	if (value === 'jpeg') return 'jpg';
	if (typeof value === 'string' && VALID_FORMATS.has(value as Format)) return value as Format;
	return 'original';
};

export function normalizeSpace(raw: unknown, fallbackIndex = 0): Space | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const obj = raw as Record<string, unknown>;

	const id =
		typeof obj.id === 'string' && obj.id.trim().length > 0
			? obj.id
			: fallbackIndex === 0
				? 'space_default'
				: `sp_${fallbackIndex}`;
	const name = typeof obj.name === 'string' ? obj.name : 'Space';
	const width = normalizeDimension(obj.width);
	const height = normalizeDimension(obj.height);
	const suffix = typeof obj.suffix === 'string' ? obj.suffix : '-min';
	const format = normalizeFormat(obj.format);
	const level =
		typeof obj.level === 'number' && Number.isFinite(obj.level)
			? Math.max(1, Math.min(9, Math.round(obj.level)))
			: 1;
	const originalOutput = typeof obj.originalOutput === 'boolean' ? obj.originalOutput : true;
	const outputDir = typeof obj.outputDir === 'string' ? obj.outputDir : '';
	const keepExif = typeof obj.keepExif === 'boolean' ? obj.keepExif : false;

	return {
		id,
		name,
		...(width !== undefined ? { width } : {}),
		...(height !== undefined ? { height } : {}),
		suffix,
		format,
		level,
		originalOutput,
		outputDir,
		keepExif
	};
}

const normalizeWindowBounds = (raw: unknown): WindowBounds | undefined => {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const obj = raw as Record<string, unknown>;
	if (typeof obj.width !== 'number' || typeof obj.height !== 'number') return undefined;
	if (!Number.isFinite(obj.width) || !Number.isFinite(obj.height)) return undefined;
	const width = Math.round(obj.width);
	const height = Math.round(obj.height);
	if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) return undefined;
	return {
		width: Math.min(MAX_WINDOW_WIDTH, width),
		height: Math.min(MAX_WINDOW_HEIGHT, height)
	};
};

const configBaseDir = () => {
	return (
		process.env.APPDATA ||
		path.join(homedir(), process.platform === 'darwin' ? 'Library/Application Support' : '.config')
	);
};

export const getConfigDir = () => {
	const override = process.env.KILO_CONFIG_DIR || process.env.PIXZIP_CONFIG_DIR;
	if (override) {
		return override;
	}
	return path.join(configBaseDir(), 'kilo');
};

const storeFile = () => {
	return path.join(getConfigDir(), 'spaces.json');
};

const legacyPixzipStoreFile = () => {
	return path.join(configBaseDir(), 'pixzip-lite', 'spaces.json');
};

const legacySpikeStoreFile = () => {
	return path.join(configBaseDir(), 'pixzip-lite-gpuix', 'spaces.json');
};

const legacyElectronStoreFiles = (): string[] => {
	if (process.env.PIXZIP_LEGACY_ELECTRON_CONFIG) {
		return [process.env.PIXZIP_LEGACY_ELECTRON_CONFIG];
	}
	return [
		path.join(configBaseDir(), 'PixZip Lite', 'config.json'),
		path.join(configBaseDir(), 'pixzip-lite', 'config.json')
	];
};

export function readSpacesFromFile(file: string): Saved | null {
	try {
		const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
			currentId?: unknown;
			dark?: unknown;
			spaces?: unknown;
			window?: unknown;
		};
		if (!Array.isArray(parsed.spaces)) return null;
		const spaces = parsed.spaces
			.map((item, index) => normalizeSpace(item, index))
			.filter((item): item is Space => item !== null);
		if (spaces.length === 0) return null;

		const currentId =
			typeof parsed.currentId === 'string' && spaces.some((space) => space.id === parsed.currentId)
				? parsed.currentId
				: spaces[0].id;
		const window = normalizeWindowBounds(parsed.window);
		return {
			currentId,
			dark: parsed.dark !== false,
			spaces,
			...(window ? { window } : {})
		};
	} catch {
		return null;
	}
}

const readSaved = (): Saved => {
	const primary = readSpacesFromFile(storeFile());
	if (primary) return primary;

	const hasCustomConfigDir = Boolean(process.env.KILO_CONFIG_DIR || process.env.PIXZIP_CONFIG_DIR);
	if (!hasCustomConfigDir) {
		const legacyPixzip = readSpacesFromFile(legacyPixzipStoreFile());
		if (legacyPixzip) return legacyPixzip;

		const legacySpike = readSpacesFromFile(legacySpikeStoreFile());
		if (legacySpike) return legacySpike;
	}

	if (!hasCustomConfigDir || process.env.PIXZIP_LEGACY_ELECTRON_CONFIG) {
		for (const candidate of legacyElectronStoreFiles()) {
			const legacyElectron = readSpacesFromFile(candidate);
			if (legacyElectron) return legacyElectron;
		}
	}

	return { currentId: DEFAULT_SPACE.id, dark: true, spaces: [{ ...DEFAULT_SPACE }] };
};

const saved = readSaved();
let windowBounds: WindowBounds | undefined = saved.window;

export const ui = $state({
	spaces: saved.spaces,
	currentId: saved.currentId,
	dark: saved.dark,
	rows: {} as Record<string, Row[]>
});

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

const writeSnapshot = () => {
	if (!dirty) return;
	const file = storeFile();
	const tmp = `${file}.tmp`;
	try {
		mkdirSync(path.dirname(file), { recursive: true });
		const data: Saved = {
			currentId: ui.currentId,
			dark: ui.dark,
			spaces: ui.spaces,
			...(windowBounds ? { window: windowBounds } : {})
		};
		writeFileSync(tmp, JSON.stringify(data, null, 2));
		renameSync(tmp, file);
		dirty = false;
	} catch (error) {
		console.warn('Failed to persist spaces:', error);
	}
};

export const flushPersist = () => {
	if (persistTimer !== null) {
		clearTimeout(persistTimer);
		persistTimer = null;
	}
	writeSnapshot();
};

const persist = () => {
	dirty = true;
	if (persistTimer !== null) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistTimer = null;
		writeSnapshot();
	}, PERSIST_DEBOUNCE_MS);
};

const hooks = globalThis as Record<symbol, boolean | undefined>;
if (!hooks[EXIT_HOOK_KEY]) {
	hooks[EXIT_HOOK_KEY] = true;
	process.on('beforeExit', flushPersist);
	process.on('exit', flushPersist);
}

export const currentSpace = () => ui.spaces.find((space) => space.id === ui.currentId);

export const selectSpace = (id: string) => {
	if (!ui.spaces.some((space) => space.id === id)) return;
	ui.currentId = id;
	persist();
};

export const patchSpace = (patch: Partial<Space>) => {
	const index = ui.spaces.findIndex((space) => space.id === ui.currentId);
	if (index < 0) return;
	ui.spaces[index] = { ...ui.spaces[index], ...patch };
	persist();
};

export const addSpace = () => {
	const space: Space = {
		...DEFAULT_SPACE,
		id: `sp_${crypto.randomUUID()}`,
		name: `Space ${ui.spaces.length + 1}`
	};
	ui.spaces.push(space);
	ui.currentId = space.id;
	persist();
};

export const getInitialWindowBounds = (): WindowBounds => {
	return windowBounds ? { ...windowBounds } : { ...DEFAULT_WINDOW_BOUNDS };
};

export const setWindowBounds = (width: number, height: number): void => {
	if (!Number.isFinite(width) || !Number.isFinite(height)) return;
	const w = Math.round(width);
	const h = Math.round(height);
	if (w < MIN_WINDOW_WIDTH || h < MIN_WINDOW_HEIGHT) return;
	const next: WindowBounds = {
		width: Math.min(MAX_WINDOW_WIDTH, w),
		height: Math.min(MAX_WINDOW_HEIGHT, h)
	};
	if (windowBounds?.width === next.width && windowBounds?.height === next.height) return;
	windowBounds = next;
	persist();
};

export const duplicateSpace = (id: string): void => {
	const index = ui.spaces.findIndex((space) => space.id === id);
	if (index < 0) return;
	const source = ui.spaces[index];
	const copy: Space = {
		...source,
		id: `sp_${crypto.randomUUID()}`,
		name: `${source.name || 'Space'} Copy`
	};
	ui.spaces.splice(index + 1, 0, copy);
	ui.currentId = copy.id;
	persist();
};

export const deleteSpace = (id: string) => {
	if (ui.spaces.length === 1) return;
	const index = ui.spaces.findIndex((space) => space.id === id);
	if (index < 0) return;
	ui.spaces.splice(index, 1);
	delete ui.rows[id];
	if (ui.currentId === id) ui.currentId = ui.spaces[Math.max(0, index - 1)].id;
	persist();
};

export const setDark = (dark: boolean) => {
	ui.dark = dark;
	persist();
};

export const rowsOf = (spaceId: string) => ui.rows[spaceId] ?? [];

export const upsertRows = (spaceId: string, rows: Row[]) => {
	ui.rows[spaceId] = [...rowsOf(spaceId), ...rows];
};

export const replaceRows = (spaceId: string, rows: Row[]) => {
	ui.rows[spaceId] = rows;
};

export const settle = (
	spaceId: string,
	filepath: string,
	token: number,
	patch: Partial<Row>
) => {
	const list = ui.rows[spaceId];
	if (!list) return;
	const index = list.findIndex((row) => row.filepath === filepath);
	if (index < 0 || list[index].token !== token) return;
	list[index] = { ...list[index], ...patch };
};
