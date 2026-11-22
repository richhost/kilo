import fs from 'node:fs';
import path, { extname } from 'node:path';

export const imageExtension: Set<string> = new Set([
	'.jpg',
	'.jpeg',
	'.png',
	'.gif',
	'.webp',
	'.avif'
]);

export type ScannedFile = {
	path: string;
	size: number;
};

export const isImage = (filepath: string): boolean => {
	return imageExtension.has(extname(filepath).toLowerCase());
};

export const scanDirectory = (dir: string): ScannedFile[] => {
	const results: ScannedFile[] = [];
	const resolved = path.resolve(dir);
	const stat = fs.statSync(resolved);

	if (stat.isFile()) {
		if (isImage(resolved)) {
			results.push({
				path: resolved,
				size: stat.size
			});
		}
		return results;
	}

	if (!stat.isDirectory()) return results;

	const list = fs.readdirSync(resolved);
	for (const file of list) {
		const filePath = path.join(resolved, file);
		let childStat: fs.Stats;
		try {
			childStat = fs.statSync(filePath);
		} catch {
			// Skip unreadable entries or broken symlinks instead of aborting the drop.
			continue;
		}

		if (childStat.isDirectory()) {
			results.push(...scanDirectory(filePath));
		} else if (childStat.isFile() && isImage(filePath)) {
			results.push({
				path: path.resolve(filePath),
				size: childStat.size
			});
		}
	}

	return results;
};
