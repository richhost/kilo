import { extname } from 'node:path';
import { decompressFrames, parseGIF } from 'gifuct-js';
import sharp from 'sharp';
import type { FormatEnum, Sharp } from 'sharp';

sharp.cache(false);

export type SharpFormat = keyof FormatEnum | 'avif' | 'jpg';

const qualityMap: Partial<Record<SharpFormat, number>> = {
	jpg: 0.85,
	jpeg: 0.85,
	png: 1,
	webp: 0.8,
	avif: 0.7,
	gif: 0.6
};

async function getGifFrameCount(filepath: string): Promise<number> {
	const arrayBuffer = await Bun.file(filepath).arrayBuffer();
	const gif = parseGIF(arrayBuffer);
	return decompressFrames(gif, false).length;
}

export type CompressTask = {
	filepath: string;
	outputPath: string;
	targetExtname: string;
	level: number;
	width?: number;
	height?: number;
	keepExif: boolean;
};

/**
 * Get file extension name, lower case without leading dot.
 */
export const getExtname = (filename: string): string => {
	return extname(filename).replace('.', '').toLowerCase();
};

const animated = (filename: string): boolean => {
	const ext = getExtname(filename);
	return ['gif', 'webp'].includes(ext);
};

const getFormat = async (task: CompressTask): Promise<SharpFormat> => {
	let format = task.targetExtname as SharpFormat;

	// In Windows, sharp/libvips can crash when writing a single-frame GIF.
	if (format === 'gif' && getExtname(task.filepath) === 'gif' && process.platform === 'win32') {
		const count = await getGifFrameCount(task.filepath);
		if (count === 1) {
			format = 'png';
		}
	}
	return format;
};

const getQuality = (format: SharpFormat, level: number): number => {
	const quality = qualityMap[format] ?? 1;
	return Math.max(1, Math.min(100, Math.floor((11 - level) * 10 * quality)));
};

const applyExif = (instance: Sharp, keep: boolean): Sharp => {
	return keep ? instance.keepExif() : instance.withExif({});
};

export const zip = async (
	task: CompressTask
): Promise<{ buffer: Buffer; format: SharpFormat }> => {
	const needAnimated = animated(task.filepath);
	const format = await getFormat(task);
	const quality = getQuality(format, task.level);
	const sharpFormat: keyof FormatEnum | 'avif' = format === 'jpg' ? 'jpeg' : format;

	const instance = sharp(task.filepath, {
		animated: needAnimated && format !== 'avif'
	})
		.withMetadata()
		.keepIccProfile();

	const buffer = await applyExif(instance, task.keepExif)
		.resize({
			width: task.width,
			height: task.height
		})
		.toFormat(sharpFormat, {
			quality,
			mozjpeg: sharpFormat === 'jpeg' ? true : undefined,
			colors: format === 'gif' ? Number.parseInt(((quality * 256) / 100).toString(), 10) : undefined,
			dither: format === 'gif' ? 0 : undefined
		})
		.toBuffer();

	return { buffer, format };
};

export async function output(
	buffer: Buffer,
	task: Pick<CompressTask, 'outputPath'>
): Promise<{ size: number; filepath: string }> {
	const outFilepath = task.outputPath;
	const size = await Bun.write(outFilepath, buffer);
	return {
		size,
		filepath: outFilepath
	};
}
