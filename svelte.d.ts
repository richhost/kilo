declare module '*.svelte' {
	const component: import('gpuix-svelte').AnyComponent;
	export default component;
}

declare module 'bun:ffi' {
	export const FFIType: {
		readonly ptr: 'ptr';
		readonly i32: 'i32';
		readonly u32: 'u32';
	};

	export type FFITypeValue = (typeof FFIType)[keyof typeof FFIType];

	export type FFIFunctionDef = {
		readonly args: readonly FFITypeValue[];
		readonly returns: FFITypeValue;
	};

	export type FFIArgMap = {
		ptr: bigint | number | null;
		i32: number;
		u32: number;
	};

	export type FFIReturnMap = {
		ptr: bigint | null;
		i32: number;
		u32: number;
	};

	type MapArgs<T extends readonly FFITypeValue[]> = {
		[K in keyof T]: T[K] extends keyof FFIArgMap ? FFIArgMap[T[K]] : never;
	};

	type MapSymbol<D extends FFIFunctionDef> = (
		...args: MapArgs<D['args']>
	) => FFIReturnMap[D['returns']];

	export function dlopen<T extends Record<string, FFIFunctionDef>>(
		path: string,
		symbols: T
	): {
		symbols: { [K in keyof T]: MapSymbol<T[K]> };
		close: () => void;
	};

	export class JSCallback {
		readonly ptr: bigint | null;
		constructor(
			fn: (...args: never[]) => unknown,
			options: { args: readonly FFITypeValue[]; returns: FFITypeValue }
		);
		close(): void;
	}

	export function ptr(data: ArrayBufferView | ArrayBuffer): bigint;
}
