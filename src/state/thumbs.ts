import sharp from 'sharp';
import { pathKey } from '../core/paths.ts';

const MAX_THUMB_CACHE = 300;
const MAX_CONCURRENCY = 2;

const cache = new Map<string, Buffer>();
const inflight = new Map<string, Promise<Buffer | null>>();
const waiting: Array<() => void> = [];
let active = 0;
let cacheEpoch = 0;

const pump = () => {
	while (active < MAX_CONCURRENCY && waiting.length > 0) {
		const start = waiting.shift();
		if (!start) return;
		active++;
		start();
	}
};

const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
	return new Promise<T>((resolve, reject) => {
		waiting.push(() => {
			work()
				.then(resolve, reject)
				.finally(() => {
					active--;
					pump();
				});
		});
		pump();
	});
};

const setCached = (key: string, buffer: Buffer) => {
	cache.delete(key);
	cache.set(key, buffer);
	while (cache.size > MAX_THUMB_CACHE) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
};

export const getThumb = (filepath: string): Promise<Buffer | null> => {
	const key = pathKey(filepath);
	const hit = cache.get(key);
	if (hit) {
		cache.delete(key);
		cache.set(key, hit);
		return Promise.resolve(hit);
	}

	const pending = inflight.get(key);
	if (pending) return pending;

	const epoch = cacheEpoch;
	const task = enqueue(async () => {
		try {
			const buffer = await sharp(filepath)
				.rotate()
				.resize({ width: 96, height: 96, fit: 'inside', withoutEnlargement: true })
				.png()
				.toBuffer();
			if (epoch === cacheEpoch) {
				setCached(key, buffer);
			}
			return buffer;
		} catch {
			return null;
		} finally {
			inflight.delete(key);
		}
	});

	inflight.set(key, task);
	return task;
};

export const clearThumbCache = () => {
	cacheEpoch++;
	cache.clear();
};
