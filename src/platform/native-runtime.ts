import {
	chmodSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import Module from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

export type EmbeddedNativeAsset = {
	relativePath: string;
	assetPath: string;
	executable?: boolean;
};

export type EmbeddedNativeBundle = {
	fingerprint: string;
	assets: EmbeddedNativeAsset[];
};

const EMBEDDED_BUNDLE_KEY = Symbol.for('kilo.embedded-natives');
const SHARP_PATCHED_KEY = Symbol.for('kilo.sharp-vendor.patched');
const SHARP_ADDON_RE = /^@img\/(sharp-[^/]+)\/sharp\.node$/;

type GlobalRegistry = typeof globalThis & {
	[EMBEDDED_BUNDLE_KEY]?: EmbeddedNativeBundle;
};

type RequirePrototype = {
	require: ((this: unknown, id: string) => unknown) & { [SHARP_PATCHED_KEY]?: boolean };
};

let extractedRoot: string | null = null;
let extractedFingerprint: string | null = null;
let extractedBaseDir: string | null = null;

function getBundle(): EmbeddedNativeBundle | undefined {
	return (globalThis as GlobalRegistry)[EMBEDDED_BUNDLE_KEY];
}

export function registerEmbeddedNatives(bundle: EmbeddedNativeBundle): void {
	(globalThis as GlobalRegistry)[EMBEDDED_BUNDLE_KEY] = bundle;
	extractedRoot = null;
	extractedFingerprint = null;
	extractedBaseDir = null;
}

export function clearEmbeddedNativesForTest(): void {
	delete (globalThis as GlobalRegistry)[EMBEDDED_BUNDLE_KEY];
	extractedRoot = null;
	extractedFingerprint = null;
	extractedBaseDir = null;
}

export function getNativeCacheBaseDir(): string {
	const override = process.env.KILO_CACHE_DIR || process.env.PIXZIP_CACHE_DIR;
	if (override) {
		return override;
	}
	if (process.platform === 'win32') {
		const localAppData =
			process.env.LOCALAPPDATA ||
			process.env.APPDATA ||
			path.join(homedir(), 'AppData', 'Local');
		return path.join(localAppData, 'kilo', 'native');
	}
	if (process.platform === 'darwin') {
		return path.join(homedir(), 'Library', 'Caches', 'kilo', 'native');
	}
	const xdgCache = process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache');
	return path.join(xdgCache, 'kilo', 'native');
}

function isTargetReady(targetDir: string, bundle: EmbeddedNativeBundle): boolean {
	if (!existsSync(path.join(targetDir, '.ready'))) return false;
	return bundle.assets.every((asset) => existsSync(path.join(targetDir, asset.relativePath)));
}

function pruneOldCaches(baseDir: string, activeFingerprint: string): void {
	try {
		for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (entry.name === activeFingerprint || entry.name.startsWith('.extract-')) continue;
			try {
				rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
			} catch {
				// Ignore locked files from another running process.
			}
		}
	} catch {
		// Best-effort cleanup only.
	}
}

export function ensureEmbeddedNatives(): string | null {
	const bundle = getBundle();
	if (!bundle || bundle.assets.length === 0) return null;

	const baseDir = getNativeCacheBaseDir();
	if (
		extractedRoot !== null &&
		extractedFingerprint === bundle.fingerprint &&
		extractedBaseDir === baseDir &&
		isTargetReady(extractedRoot, bundle)
	) {
		return extractedRoot;
	}

	const targetDir = path.join(baseDir, bundle.fingerprint);
	if (isTargetReady(targetDir, bundle)) {
		extractedRoot = targetDir;
		extractedFingerprint = bundle.fingerprint;
		extractedBaseDir = baseDir;
		return targetDir;
	}

	mkdirSync(baseDir, { recursive: true });
	const stagingDir = path.join(
		baseDir,
		`.extract-${bundle.fingerprint}-${process.pid}-${Date.now()}`
	);

	try {
		mkdirSync(stagingDir, { recursive: true });
		for (const asset of bundle.assets) {
			const dest = path.join(stagingDir, asset.relativePath);
			mkdirSync(path.dirname(dest), { recursive: true });
			writeFileSync(dest, readFileSync(asset.assetPath));
			if (asset.executable && process.platform !== 'win32') {
				chmodSync(dest, 0o755);
			}
		}
		writeFileSync(path.join(stagingDir, '.ready'), `${bundle.fingerprint}\n`);

		try {
			renameSync(stagingDir, targetDir);
		} catch {
			if (!isTargetReady(targetDir, bundle)) {
				rmSync(targetDir, { recursive: true, force: true });
				renameSync(stagingDir, targetDir);
			}
		}
	} finally {
		rmSync(stagingDir, { recursive: true, force: true });
	}

	extractedRoot = targetDir;
	extractedFingerprint = bundle.fingerprint;
	extractedBaseDir = baseDir;
	pruneOldCaches(baseDir, bundle.fingerprint);
	return targetDir;
}

function findSharpNodeFile(rootDir: string, pkg: string): string | undefined {
	const libDir = path.join(rootDir, 'node_modules', '@img', pkg, 'lib');
	const exact = path.join(libDir, `${pkg}.node`);
	if (existsSync(exact)) return exact;
	if (!existsSync(libDir)) return undefined;
	try {
		const match = readdirSync(libDir).find((name) => name.endsWith('.node'));
		return match ? path.join(libDir, match) : undefined;
	} catch {
		return undefined;
	}
}

export function installSharpVendorHook(): void {
	const runtime = Module as unknown as { prototype: RequirePrototype };
	const original = runtime.prototype.require;
	if (original[SHARP_PATCHED_KEY]) return;

	const patched = function (this: unknown, id: string) {
		if (typeof id === 'string') {
			const match = SHARP_ADDON_RE.exec(id);
			if (match) {
				const pkg = match[1];
				const roots: string[] = [];
				const embeddedRoot = ensureEmbeddedNatives();
				if (embeddedRoot) roots.push(embeddedRoot);
				roots.push(
					path.dirname(process.execPath),
					path.resolve(path.dirname(process.execPath), '../Resources')
				);
				for (const root of roots) {
					const binding = findSharpNodeFile(root, pkg);
					if (binding) return original.call(this, binding);
				}
			}
		}
		return original.call(this, id);
	};

	patched[SHARP_PATCHED_KEY] = true;
	runtime.prototype.require = patched;
}

export function resolveClipboardAddonPath(): string | undefined {
	const rel = `${process.platform}-${process.arch}/node.napi.node`;
	const candidates: string[] = [];
	const embeddedRoot = ensureEmbeddedNatives();
	if (embeddedRoot) {
		candidates.push(path.join(embeddedRoot, 'clipboard', rel));
	}
	candidates.push(
		path.join(path.dirname(process.execPath), rel),
		path.resolve(path.dirname(process.execPath), '../Resources', rel),
		path.resolve(import.meta.dirname, '../../native/clipboard', rel)
	);
	return candidates.find((file) => existsSync(file));
}

installSharpVendorHook();
