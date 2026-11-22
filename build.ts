// `bun build.ts` (or `bun run build`): compiles `standalone.ts` together with embedded `sharp`
// and `clipboard` native libraries into a single self-contained platform binary under `dist/`.
// Pass `--archive` to also write the release zip and update fragment, or `--aot` / `--trim` to
// opt into Bun's experimental size/startup flags.

import { createHash } from 'node:crypto';
import {
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { arch, platform } from 'node:os';
import path from 'node:path';
import { build } from 'gpuix-svelte/build';

type CollectedAsset = {
	importPath: string;
	relativePath: string;
	fullPath: string;
	executable: boolean;
};

const NATIVE_EXT_RE = /\.(node|dll|dylib)$|\.so(\.\d+)*$/i;
const GENERATED_ASSETS_FILE = path.resolve('.native-assets.ts');
const GENERATED_ENTRY_FILE = path.resolve('.standalone-build.ts');

const currentPlatform = platform();
const currentArch = arch();
const target = `${currentPlatform}-${currentArch}`;

function isTargetSharpPackage(name: string): boolean {
	if (!name.startsWith('sharp-') || !name.endsWith(`-${currentArch}`)) return false;
	return name.includes(`-${currentPlatform}-`) || name.includes(`-${currentPlatform}musl-`);
}

function collectFiles(rootDir: string, dir: string, results: string[] = []): string[] {
	if (!existsSync(dir)) return results;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		let isDir = false;
		let isFile = false;
		try {
			const stat = statSync(fullPath);
			isDir = stat.isDirectory();
			isFile = stat.isFile();
		} catch {
			continue;
		}
		if (isDir) {
			collectFiles(rootDir, fullPath, results);
		} else if (isFile && NATIVE_EXT_RE.test(entry.name)) {
			results.push(path.relative(rootDir, fullPath).replaceAll('\\', '/'));
		}
	}
	return results;
}

function collectNativeAssets(): CollectedAsset[] {
	const assets: CollectedAsset[] = [];
	const imgDir = path.resolve('node_modules', '@img');
	if (!existsSync(imgDir)) {
		throw new Error(`Missing sharp native directory: ${imgDir}`);
	}

	for (const entry of readdirSync(imgDir, { withFileTypes: true })) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		if (!isTargetSharpPackage(entry.name)) continue;

		const libDir = path.join(imgDir, entry.name, 'lib');
		for (const relUnderLib of collectFiles(libDir, libDir)) {
			const rel = `node_modules/@img/${entry.name}/lib/${relUnderLib}`;
			assets.push({
				importPath: `./${rel}`,
				relativePath: rel,
				fullPath: path.resolve(rel),
				executable: !relUnderLib.toLowerCase().endsWith('.dll')
			});
		}
	}

	const hasNodeAddon = assets.some((asset) => asset.relativePath.endsWith('.node'));
	const hasLibvips = assets.some((asset) =>
		path.basename(asset.relativePath).toLowerCase().includes('vips')
	);
	if (!hasNodeAddon || !hasLibvips) {
		throw new Error(
			`Incomplete sharp prebuild for ${target}: nodeAddon=${hasNodeAddon}, libvips=${hasLibvips}`
		);
	}

	const clipboardPath = path.resolve('native/clipboard', target, 'node.napi.node');
	if (existsSync(clipboardPath)) {
		const rel = `clipboard/${target}/node.napi.node`;
		assets.push({
			importPath: `./native/clipboard/${target}/node.napi.node`,
			relativePath: rel,
			fullPath: clipboardPath,
			executable: currentPlatform !== 'win32'
		});
	} else {
		console.warn(`Notice: clipboard addon not available for ${target} (${clipboardPath})`);
	}

	const fontsDir = path.resolve('assets', 'fonts');
	if (existsSync(fontsDir)) {
		for (const entry of readdirSync(fontsDir, { withFileTypes: true })) {
			if (!entry.isFile() || !/\.(otf|ttf)$/i.test(entry.name)) continue;
			const rel = `fonts/${entry.name}`;
			assets.push({
				importPath: `./assets/fonts/${entry.name}`,
				relativePath: rel,
				fullPath: path.join(fontsDir, entry.name),
				executable: false
			});
		}
	}

	assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
	return assets;
}

function computeFingerprint(assets: CollectedAsset[]): string {
	const hash = createHash('sha256');
	for (const asset of assets) {
		const bytes = readFileSync(asset.fullPath);
		hash.update(asset.relativePath);
		hash.update('\0');
		hash.update(String(bytes.length));
		hash.update('\0');
		hash.update(bytes);
	}
	return hash.digest('hex').slice(0, 16);
}

const collected = collectNativeAssets();
const fingerprint = computeFingerprint(collected);

const importLines = collected.map(
	(asset, index) => `import asset${index} from ${JSON.stringify(asset.importPath)} with { type: 'file' };`
);
const assetEntries = collected.map(
	(asset, index) =>
		`\t\t{ relativePath: ${JSON.stringify(asset.relativePath)}, assetPath: asset${index}, executable: ${asset.executable} }`
);

const generatedAssetsSource = [
	"import { registerEmbeddedNatives } from './src/platform/native-runtime.ts';",
	...importLines,
	'',
	'registerEmbeddedNatives({',
	`\tfingerprint: ${JSON.stringify(fingerprint)},`,
	'\tassets: [',
	assetEntries.join(',\n'),
	'\t]',
	'});',
	''
].join('\n');

const standaloneSource = readFileSync(path.resolve('standalone.ts'), 'utf8');
const generatedEntrySource = `import './.native-assets.ts';\n${standaloneSource}`;

writeFileSync(GENERATED_ASSETS_FILE, generatedAssetsSource);
writeFileSync(GENERATED_ENTRY_FILE, generatedEntrySource);

try {
	const result = await build({
		entry: GENERATED_ENTRY_FILE,
		archive: process.argv.includes('--archive'),
		aot: process.argv.includes('--aot'),
		trim: process.argv.includes('--trim')
	});

	console.log(
		JSON.stringify(
			{
				output: result.output,
				binary: result.binary,
				archive: result.archive ?? null,
				fragment: result.fragment ?? null,
				fingerprint,
				embeddedAssets: collected.map((asset) => asset.relativePath)
			},
			null,
			2
		)
	);
} finally {
	rmSync(GENERATED_ASSETS_FILE, { force: true });
	rmSync(GENERATED_ENTRY_FILE, { force: true });
}
