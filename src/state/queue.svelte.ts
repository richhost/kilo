import { statSync } from 'node:fs';
import { output, zip } from '../core/compress.ts';
import { pathKey, targetExtname, uniqueOutputPath, uniquePathWithExt } from '../core/paths.ts';
import type { Row, Space } from '../core/types.ts';
import { replaceRows, rowsOf, settle, upsertRows } from './spaces.svelte.ts';

type Job = {
	space: Space;
	filepath: string;
	token: number;
};

const pending: Job[] = [];
let running = 0;

const makeRow = (
	space: Space,
	filepath: string,
	fileSize: number,
	token = 1,
	reserved?: Set<string>
): Row => {
	const ext = targetExtname(filepath, 'original');
	const used = reserved ?? new Set<string>();
	return {
		spaceId: space.id,
		filepath,
		status: 'processing',
		outputPath: uniqueOutputPath(filepath, space, used),
		fileSize,
		outSize: 0,
		extname: ext,
		targetExtname: targetExtname(filepath, space.format),
		token,
		error: ''
	};
};

const isCurrentJob = (job: Job): boolean => {
	return rowsOf(job.space.id).some(
		(item) => item.filepath === job.filepath && item.token === job.token
	);
};

const pump = () => {
	while (running < 5 && pending.length > 0) {
		const job = pending.shift();
		if (!job) return;
		running++;
		run(job).finally(() => {
			running--;
			pump();
		});
	}
};

const run = async (job: Job) => {
	const row = rowsOf(job.space.id).find((item) => item.filepath === job.filepath);
	if (!row || row.token !== job.token) return;
	try {
		const task = {
			...job.space,
			filepath: job.filepath,
			outputPath: row.outputPath,
			targetExtname: row.targetExtname
		};
		const { buffer, format } = await zip(task);
		if (!isCurrentJob(job)) return;

		const actualFormat = String(format);
		let finalOutputPath = task.outputPath;
		if (actualFormat !== task.targetExtname) {
			const reserved = new Set(
				rowsOf(job.space.id)
					.filter((item) => item.filepath !== job.filepath)
					.map((item) => pathKey(item.outputPath))
			);
			finalOutputPath = uniquePathWithExt(task.outputPath, actualFormat, reserved);
		}

		const written = await output(buffer, { outputPath: finalOutputPath });
		settle(job.space.id, job.filepath, job.token, {
			status: 'completed',
			outputPath: written.filepath,
			targetExtname: actualFormat,
			outSize: written.size,
			error: ''
		});
	} catch (error) {
		if (!isCurrentJob(job)) return;
		const message = error instanceof Error && error.message ? error.message : 'Compression failed';
		settle(job.space.id, job.filepath, job.token, { status: 'failed', error: message });
	}
};

const snapshotOf = (space: Space): Space => ({
	id: space.id,
	name: space.name,
	width: space.width,
	height: space.height,
	suffix: space.suffix,
	format: space.format,
	level: space.level,
	originalOutput: space.originalOutput,
	outputDir: space.outputDir,
	keepExif: space.keepExif
});

export const enqueueRows = (rows: Row[], space: Space) => {
	const snapshot = snapshotOf(space);
	for (const row of rows) {
		pending.push({ space: snapshot, filepath: row.filepath, token: row.token });
	}
	pump();
};

export const addFiles = (space: Space, files: { path: string; size: number }[]) => {
	const existing = rowsOf(space.id);
	const known = new Set(existing.map((row) => pathKey(row.filepath)));
	const reserved = new Set(existing.map((row) => pathKey(row.outputPath)));
	const fresh = files.filter((file) => {
		const key = pathKey(file.path);
		if (known.has(key)) return false;
		known.add(key);
		return true;
	});
	const rows = fresh.map((file) => makeRow(space, file.path, file.size, 1, reserved));
	if (rows.length === 0) return 0;
	upsertRows(space.id, rows);
	enqueueRows(rows, space);
	return rows.length;
};

const refreshFileSize = (filepath: string, fallback: number): number => {
	try {
		return statSync(filepath).size;
	} catch {
		return fallback;
	}
};

export const recompress = (space: Space) => {
	for (let i = pending.length - 1; i >= 0; i--) {
		if (pending[i].space.id === space.id) pending.splice(i, 1);
	}
	const reserved = new Set<string>();
	const next = rowsOf(space.id).map((row) =>
		makeRow(
			space,
			row.filepath,
			refreshFileSize(row.filepath, row.fileSize),
			row.token + 1,
			reserved
		)
	);
	replaceRows(space.id, next);
	enqueueRows(next, space);
};

export const retryFile = (space: Space, filepath: string): boolean => {
	const current = rowsOf(space.id);
	const index = current.findIndex((row) => row.filepath === filepath);
	if (index < 0) return false;

	for (let i = pending.length - 1; i >= 0; i--) {
		if (pending[i].space.id === space.id && pending[i].filepath === filepath) pending.splice(i, 1);
	}

	const target = current[index];
	const reserved = new Set(
		current.filter((row) => row.filepath !== filepath).map((row) => pathKey(row.outputPath))
	);
	const updated = makeRow(
		space,
		target.filepath,
		refreshFileSize(target.filepath, target.fileSize),
		target.token + 1,
		reserved
	);

	const next = current.slice();
	next[index] = updated;
	replaceRows(space.id, next);
	enqueueRows([updated], space);
	return true;
};

export const clearSpace = (spaceId: string) => {
	for (let i = pending.length - 1; i >= 0; i--) {
		if (pending[i].space.id === spaceId) pending.splice(i, 1);
	}
	replaceRows(spaceId, []);
};

export const removeFile = (spaceId: string, filepath: string) => {
	for (let i = pending.length - 1; i >= 0; i--) {
		if (pending[i].space.id === spaceId && pending[i].filepath === filepath) pending.splice(i, 1);
	}
	replaceRows(
		spaceId,
		rowsOf(spaceId).filter((row) => row.filepath !== filepath)
	);
};
