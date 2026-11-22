import path from 'node:path';
import type { Format, Space } from './types.ts';

export const targetExtname = (filepath: string, format: Format): string => {
	const ext = path.extname(filepath).replace('.', '').toLowerCase();
	if (format === 'original') return ext;
	return format;
};

export const pathKey = (filepath: string): string => {
	const resolved = path.resolve(filepath);
	return process.platform === 'win32' || process.platform === 'darwin'
		? resolved.toLowerCase()
		: resolved;
};

export const isSamePath = (a: string, b: string): boolean => {
	return pathKey(a) === pathKey(b);
};

export const replaceExtname = (filepath: string, ext: string): string => {
	const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
	const currentExt = path.extname(filepath);
	if (!currentExt) return `${filepath}${normalizedExt}`;
	return `${filepath.slice(0, -currentExt.length)}${normalizedExt}`;
};

const pickUniquePath = (dir: string, stem: string, ext: string, reserved: Set<string>): string => {
	const cleanExt = ext.replace(/^\./, '');
	const suffix = cleanExt ? `.${cleanExt}` : '';
	let index = 1;
	while (true) {
		const name = index === 1 ? `${stem}${suffix}` : `${stem}-${index}${suffix}`;
		const candidate = path.join(dir, name);
		const key = pathKey(candidate);
		if (!reserved.has(key)) {
			reserved.add(key);
			return candidate;
		}
		index++;
	}
};

export const uniqueOutputPath = (
	filepath: string,
	space: Space,
	reserved: Set<string>
): string => {
	const dir =
		!space.originalOutput && space.outputDir ? space.outputDir : path.dirname(filepath);
	const base = path.basename(filepath, path.extname(filepath));
	const ext = targetExtname(filepath, space.format);
	return pickUniquePath(dir, `${base}${space.suffix}`, ext, reserved);
};

export const uniquePathWithExt = (
	outputPath: string,
	ext: string,
	reserved: Set<string>
): string => {
	const replaced = replaceExtname(outputPath, ext);
	const dir = path.dirname(replaced);
	const stem = path.basename(replaced, path.extname(replaced));
	return pickUniquePath(dir, stem, ext, reserved);
};

export const outputPathFor = (filepath: string, space: Space): string => {
	const dir =
		!space.originalOutput && space.outputDir ? space.outputDir : path.dirname(filepath);
	const base = path.basename(filepath, path.extname(filepath));
	return path.join(dir, `${base}${space.suffix}.${targetExtname(filepath, space.format)}`);
};

export const parentFolderName = (filepath: string): string => {
	return path.basename(path.dirname(filepath));
};

export const bytes = (size: number): string => {
	if (!Number.isFinite(size) || size < 0) return '—';
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = size;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index++;
	}
	const digits = index === 0 ? 0 : 1;
	return `${value.toFixed(digits)} ${units[index]}`;
};

export const savedPercent = (before: number, after: number): number => {
	if (before <= 0) return 0;
	return Math.round(((before - after) / before) * 1000) / 10;
};
