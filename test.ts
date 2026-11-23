import './src/platform/native-runtime.ts';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hasTestGpuixRenderer } from '@gpuix/native';
import {
	all_text,
	check,
	click_test_id,
	clock_fast_forward,
	finish,
	mount_headless,
	settle,
	wait
} from 'gpuix-svelte/test';
import sharp from 'sharp';

const workDir = mkdtempSync(path.join(tmpdir(), 'kilo-test-'));
const configDir = path.join(workDir, 'config');
const cacheDir = path.join(workDir, 'native-cache');
process.env.KILO_CONFIG_DIR = configDir;
process.env.KILO_CACHE_DIR = cacheDir;

const { scanDirectory } = await import('./src/core/scan.ts');
const { isSamePath, outputPathFor } = await import('./src/core/paths.ts');
const { hasClipboardSupport } = await import('./src/platform/desktop.ts');
const {
	clearEmbeddedNativesForTest,
	ensureEmbeddedNatives,
	registerEmbeddedNatives
} = await import('./src/platform/native-runtime.ts');
const {
	currentSpace,
	deleteSpace,
	duplicateSpace,
	flushPersist,
	normalizeSpace,
	patchSpace,
	readSpacesFromFile,
	rowsOf,
	setWindowBounds,
	ui,
	upsertRows
} = await import('./src/state/spaces.svelte.ts');
const { addFiles, clearSpace, retryFile } = await import('./src/state/queue.svelte.ts');
const { clearThumbCache, getThumb } = await import('./src/state/thumbs.ts');
const { default: App } = await import('./App.svelte');

const CORE_CHECKS = 28;
const UI_CHECKS = 9;

try {
	const space = currentSpace();
	check('default space exists', Boolean(space), true);
	if (!space) throw new Error('Expected default space');

	const inputDir = path.join(workDir, 'in');
	mkdirSync(inputDir, { recursive: true });

	const samplePath = path.join(inputDir, 'sample.png');
	const bmpPath = path.join(inputDir, 'ignored.bmp');
	const txtPath = path.join(inputDir, 'notes.txt');

	const png = await sharp({
		create: { width: 32, height: 32, channels: 3, background: { r: 20, g: 140, b: 220 } }
	})
		.png()
		.toBuffer();

	writeFileSync(samplePath, png);
	writeFileSync(bmpPath, Buffer.from('BM'));
	writeFileSync(txtPath, 'not an image');

	// 1. Scan filtering excludes unsupported formats (.bmp, .txt).
	const scanned = scanDirectory(inputDir);
	check(
		'scanDirectory filters unsupported formats',
		JSON.stringify(scanned.map((item) => item.path)),
		JSON.stringify([path.resolve(samplePath)])
	);

	// 2. Compression success with isolated config directory.
	patchSpace({
		format: 'webp',
		originalOutput: true,
		suffix: '-min',
		level: 4
	});
	const updatedSpace = currentSpace();
	if (!updatedSpace) throw new Error('Expected updated space');

	const waitForStatus = async (spaceId: string, filepath: string) => {
		const deadline = Date.now() + 20_000;
		let row = rowsOf(spaceId).find((item) => item.filepath === filepath);
		while (Date.now() < deadline && row?.status === 'processing') {
			await new Promise((resolve) => setTimeout(resolve, 50));
			row = rowsOf(spaceId).find((item) => item.filepath === filepath);
		}
		return row;
	};

	const addedSample = addFiles(updatedSpace, scanned);
	check('addFiles queues scanned png', addedSample, 1);

	const completedRow = await waitForStatus(updatedSpace.id, path.resolve(samplePath));
	check('compression status is completed', completedRow?.status, 'completed');
	check(
		'compression writes expected webp output path',
		completedRow?.outputPath,
		path.join(path.resolve(inputDir), 'sample-min.webp')
	);
	check('compressed output size is > 0', (completedRow?.outSize ?? 0) > 0, true);
	if (!completedRow) throw new Error('Expected completed row');

	const outMeta = await sharp(completedRow.outputPath).metadata();
	check('output metadata format is webp', outMeta.format, 'webp');

	// 3. Corrupt file failure handling & single-row retryFile.
	const brokenPath = path.join(inputDir, 'broken.png');
	writeFileSync(brokenPath, Buffer.from('not a valid png'));
	const brokenScanned = scanDirectory(brokenPath);
	addFiles(updatedSpace, brokenScanned);

	const failedRow = await waitForStatus(updatedSpace.id, path.resolve(brokenPath));
	check('broken image fails', failedRow?.status, 'failed');
	check('broken image populates error message', (failedRow?.error.length ?? 0) > 0, true);

	writeFileSync(brokenPath, png);
	check('retryFile queues broken row', retryFile(updatedSpace, path.resolve(brokenPath)), true);
	const retriedRow = await waitForStatus(updatedSpace.id, path.resolve(brokenPath));
	check('retried row completes', retriedRow?.status, 'completed');

	clearSpace(updatedSpace.id);
	check('clearSpace empties rows', rowsOf(updatedSpace.id).length, 0);

	// 4. Custom directory basename collision disambiguation.
	const dirA = path.join(workDir, 'dirA');
	const dirB = path.join(workDir, 'dirB');
	const customOutDir = path.join(workDir, 'out');
	mkdirSync(dirA, { recursive: true });
	mkdirSync(dirB, { recursive: true });
	const dupA = path.join(dirA, 'dup.png');
	const dupB = path.join(dirB, 'dup.png');
	writeFileSync(dupA, png);
	writeFileSync(dupB, png);

	patchSpace({
		originalOutput: false,
		outputDir: customOutDir,
		format: 'webp',
		suffix: '-min',
		level: 4
	});
	const customSpace = currentSpace();
	if (!customSpace) throw new Error('Expected custom space');

	const addedDups = addFiles(customSpace, [
		{ path: dupA, size: png.length },
		{ path: dupB, size: png.length }
	]);
	check('duplicate basenames queued', addedDups, 2);

	const rowA = await waitForStatus(customSpace.id, dupA);
	const rowB = await waitForStatus(customSpace.id, dupB);
	check('first duplicate output path', rowA?.outputPath, path.join(customOutDir, 'dup-min.webp'));
	check(
		'second duplicate output path',
		rowB?.outputPath,
		path.join(customOutDir, 'dup-min-2.webp')
	);
	check(
		'both deduplicated files exist on disk',
		Boolean(rowA && rowB && existsSync(rowA.outputPath) && existsSync(rowB.outputPath)),
		true
	);

	clearSpace(customSpace.id);

	// 5. Same-path overwrite guard check.
	check('isSamePath detects identical paths', isSamePath(samplePath, samplePath), true);
	check(
		'isSamePath catches overwrite configuration',
		isSamePath(
			samplePath,
			outputPathFor(samplePath, {
				...customSpace,
				originalOutput: true,
				format: 'original',
				suffix: ''
			})
		),
		true
	);

	// 6. Stale cancellation prevents writing cancelled task output.
	const cancelInput = path.join(workDir, 'cancel.png');
	const cancelOutDir = path.join(workDir, 'cancel-out');
	writeFileSync(cancelInput, png);
	patchSpace({
		originalOutput: false,
		outputDir: cancelOutDir,
		format: 'webp',
		suffix: '-min'
	});
	const cancelSpace = currentSpace();
	if (!cancelSpace) throw new Error('Expected cancel space');
	addFiles(cancelSpace, [{ path: cancelInput, size: png.length }]);
	clearSpace(cancelSpace.id);
	await new Promise((resolve) => setTimeout(resolve, 150));
	check('cancelled space rows stay empty', rowsOf(cancelSpace.id).length, 0);
	check(
		'cancelled compression writes nothing to disk',
		existsSync(path.join(cancelOutDir, 'cancel-min.webp')),
		false
	);

	// 7. Thumbnail cache & deduplication check.
	const thumb1 = await getThumb(samplePath);
	const thumb2 = await getThumb(samplePath);
	check(
		'thumbnail returns PNG buffer',
		Boolean(thumb1 && thumb1.subarray(1, 4).toString('ascii') === 'PNG'),
		true
	);
	check('thumbnail cache returns same instance', thumb1 === thumb2, true);

	// 8. Space normalization, legacy Electron migration, duplicate/delete, window bounds.
	const normalized = normalizeSpace({
		id: 'legacy_1',
		name: 'Legacy',
		width: -10,
		height: 0,
		suffix: '-opt',
		format: 'jpeg',
		level: 25,
		originalOutput: true,
		outputDir: '',
		keepExif: true
	});
	check(
		'normalizeSpace clamps level and maps jpeg to jpg',
		Boolean(
			normalized &&
				normalized.format === 'jpg' &&
				normalized.level === 9 &&
				normalized.width === undefined &&
				normalized.height === undefined
		),
		true
	);

	const legacyConfigPath = path.join(workDir, 'legacy-config.json');
	writeFileSync(
		legacyConfigPath,
		JSON.stringify({
			spaces: [
				{
					id: 'old_space',
					name: 'Old Electron',
					suffix: '-old',
					format: 'jpeg',
					level: 3,
					originalOutput: true,
					outputDir: '',
					keepExif: false
				}
			]
		})
	);
	const migrated = readSpacesFromFile(legacyConfigPath);
	check(
		'legacy Electron config migrates cleanly',
		Boolean(migrated?.spaces[0].id === 'old_space' && migrated.spaces[0].format === 'jpg'),
		true
	);

	const initialCount = ui.spaces.length;
	duplicateSpace(cancelSpace.id);
	const duplicated = currentSpace();
	const dupAdded =
		ui.spaces.length === initialCount + 1 &&
		Boolean(duplicated && duplicated.id !== cancelSpace.id && duplicated.name.includes('Copy'));
	if (duplicated) deleteSpace(duplicated.id);
	check(
		'duplicateSpace clones and deleteSpace restores count',
		dupAdded && ui.spaces.length === initialCount,
		true
	);

	setWindowBounds(1400, 900);
	flushPersist();
	const savedState = readSpacesFromFile(path.join(configDir, 'spaces.json'));
	check(
		'flushPersist writes window bounds',
		JSON.stringify(savedState?.window),
		JSON.stringify({ width: 1400, height: 900 })
	);

	// 9. Embedded native runtime extraction, cache reuse, and old-fingerprint pruning.
	const staleNativeDir = path.join(cacheDir, 'oldfingerprint000');
	mkdirSync(staleNativeDir, { recursive: true });
	writeFileSync(path.join(staleNativeDir, 'stale.txt'), 'old');
	const sourceDummy = path.join(workDir, 'dummy.bin');
	writeFileSync(sourceDummy, 'native-payload');
	registerEmbeddedNatives({
		fingerprint: 'testfp0123456789',
		assets: [{ relativePath: 'node_modules/@img/test/dummy.bin', assetPath: sourceDummy }]
	});
	const extractedDir = ensureEmbeddedNatives();
	const secondHit = ensureEmbeddedNatives();
	check(
		'embedded native runtime extracts assets and prunes old cache',
		Boolean(
			extractedDir &&
				extractedDir === secondHit &&
				existsSync(path.join(extractedDir, '.ready')) &&
				readFileSync(path.join(extractedDir, 'node_modules/@img/test/dummy.bin'), 'utf8') ===
					'native-payload' &&
				!existsSync(staleNativeDir)
		),
		true
	);
	clearEmbeddedNativesForTest();

	// 10. Clipboard capability helper.
	check('hasClipboardSupport returns boolean', typeof hasClipboardSupport(), 'boolean');

	// 11. Headless GPUI hit-testing & virtual Scroller checks.
	if (hasTestGpuixRenderer()) {
		const mounted = mount_headless(App, { width: 1180, height: 760 });
		try {
			settle();
			const emptyTexts = all_text();
			check(
				'App renders title and empty state',
				emptyTexts.includes('Spaces') &&
					emptyTexts.includes('Configuration') &&
					emptyTexts.includes('Drop images here'),
				true
			);

			click_test_id('add-space');
			const createdSpace = ui.spaces.find((item) => item.name === 'Space 2');
			check('click add-space creates Space 2', Boolean(createdSpace), true);
			check('Space 2 appears in rendered GPUI tree', all_text().includes('Space 2'), true);
			click_test_id('delete-space');
			check(
				'click delete-space opens confirmation popover',
				all_text().includes('Delete space?'),
				true
			);
			click_test_id('delete-space-confirm');
			clock_fast_forward(250);
			check(
				'confirming delete popover removes Space 2',
				!ui.spaces.some((item) => item.name === 'Space 2') && !all_text().includes('Delete space?'),
				true
			);

			const initialDark = ui.dark;
			click_test_id('toggle-theme');
			check('click toggle-theme flips dark mode', ui.dark !== initialDark, true);
			click_test_id('toggle-theme');

			click_test_id('open-about');
			const aboutTexts = all_text();
			check(
				'click open-about opens About dialog',
				aboutTexts.includes('About Kilo') && aboutTexts.some((t) => t.includes('v3.3.1')),
				true
			);
			click_test_id('about-close');
			clock_fast_forward(250);
			check(
				'click about-close dismisses About dialog',
				!all_text().includes('About Kilo'),
				true
			);

			const activeSpaceId = currentSpace()?.id ?? cancelSpace.id;
			upsertRows(activeSpaceId, [
				{
					spaceId: activeSpaceId,
					filepath: path.resolve(samplePath),
					status: 'completed',
					outputPath: completedRow.outputPath,
					fileSize: png.length,
					outSize: completedRow.outSize,
					extname: 'png',
					targetExtname: 'webp',
					token: 1,
					error: ''
				}
			]);
			settle();
			await wait(30);
			settle();
			const rowTexts = all_text();
			check(
				'FileRow renders inside virtual Scroller',
				rowTexts.includes('sample.png') && rowTexts.includes('in'),
				true
			);
			clearSpace(activeSpaceId);
		} finally {
			clearThumbCache();
			await mounted.unmount();
		}
	}
} finally {
	clearEmbeddedNativesForTest();
	rmSync(workDir, { recursive: true, force: true });
}

const expected = hasTestGpuixRenderer() ? CORE_CHECKS + UI_CHECKS : CORE_CHECKS;
finish('kilo', expected);
