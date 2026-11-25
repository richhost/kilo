import { prompt_for_paths } from 'gpuix-svelte';
import { toast } from 'gpuix-svelte-ui';
import { isSamePath } from '../core/paths.ts';
import { scanDirectory, type ScannedFile } from '../core/scan.ts';
import type { Row } from '../core/types.ts';
import { copyFilePath, revealPath, trashPath } from '../platform/desktop.ts';
import { addFiles, clearSpace, recompress, removeFile, retryFile } from './queue.svelte.ts';
import { currentSpace, deleteSpace, patchSpace, rowsOf, ui } from './spaces.svelte.ts';

const scan = (targets: string[]) => {
	const found: ScannedFile[] = [];
	for (const target of targets) {
		found.push(...scanDirectory(target));
	}
	return found;
};

export const ingest = (targets: string[]) => {
	const space = currentSpace();
	if (!space || targets.length === 0) return;
	let found: ScannedFile[] = [];
	try {
		found = scan(targets);
	} catch (error) {
		toast({
			title: 'Could not read the drop',
			description: error instanceof Error ? error.message : String(error),
			tone: 'danger'
		});
		return;
	}
	const added = addFiles(space, found);
	if (added === 0) toast('No new images');
	else toast({ title: `Compressing ${added} image${added === 1 ? '' : 's'}`, tone: 'success' });
};

const pick = async (options: {
	files?: boolean;
	directories?: boolean;
	multiple?: boolean;
	prompt?: string;
}) => {
	try {
		return await prompt_for_paths(options);
	} catch (error) {
		toast({
			title: 'Could not open the file picker',
			description: error instanceof Error ? error.message : String(error),
			tone: 'danger'
		});
		return null;
	}
};

export const openFiles = async () => {
	const picked = await pick({ files: true, directories: false, multiple: true });
	if (picked?.length) ingest(picked);
};

export const openFolder = async () => {
	const picked = await pick({
		files: false,
		directories: true,
		multiple: true,
		prompt: 'Image folder'
	});
	if (picked?.length) ingest(picked);
};

export const chooseOutputDir = async () => {
	const picked = await pick({ directories: true, files: false, prompt: 'Output folder' });
	const dir = picked?.[0];
	if (!dir) return;
	patchSpace({ originalOutput: false, outputDir: dir });
};

export const compressAgain = () => {
	const space = currentSpace();
	if (!space) return;
	if (rowsOf(space.id).length === 0) {
		toast('Nothing to compress');
		return;
	}
	recompress(space);
};

export const clearCurrent = () => {
	const space = currentSpace();
	if (!space) return;
	clearSpace(space.id);
};

export const removeSpace = (id: string) => {
	clearSpace(id);
	deleteSpace(id);
};

export const showFile = (row: Row) => {
	const target = row.status === 'completed' ? row.outputPath : row.filepath;
	revealPath(target);
};

export const copyFile = async (row: Row) => {
	const target = row.status === 'completed' ? row.outputPath : row.filepath;
	try {
		if (!(await Bun.file(target).stat()).isFile()) throw new Error('File is not on disk.');
		await copyFilePath(target);
		toast('Copied to the clipboard');
	} catch (error) {
		toast({
			title: 'Could not copy',
			description: error instanceof Error ? error.message : String(error),
			tone: 'danger'
		});
	}
};

export const removeRow = (row: Row) => {
	removeFile(row.spaceId, row.filepath);
};

export const retryRow = (row: Row) => {
	const space = ui.spaces.find((item) => item.id === row.spaceId);
	if (!space) return;
	retryFile(space, row.filepath);
};

export const deleteOutput = async (row: Row) => {
	if (row.status !== 'completed') return;
	if (isSamePath(row.filepath, row.outputPath)) {
		toast({
			title: 'Cannot delete the original file',
			tone: 'warning'
		});
		return;
	}
	try {
		await trashPath(row.outputPath);
		removeFile(row.spaceId, row.filepath);
		toast('Moved to the recycle bin');
	} catch (error) {
		toast({
			title: 'Could not delete',
			description: error instanceof Error ? error.message : String(error),
			tone: 'danger'
		});
	}
};
