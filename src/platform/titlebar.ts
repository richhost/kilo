import { dlopen, FFIType, JSCallback, ptr } from 'bun:ffi';

// GNOME's Wayland compositor draws no server-side titlebar and @gpuix/native@0.11.0 does not
// expose window move, so GPUI falls back to a static non-draggable bar. On GNOME with XWayland
// available, clearing WAYLAND_DISPLAY before GPUI initializes lets Mutter draw a native titlebar.
const WAYLAND_ENV_KEY = Symbol.for('kilo.original-wayland-display');

type GlobalWaylandEnv = typeof globalThis & {
	[WAYLAND_ENV_KEY]?: string;
};

export function getOriginalWaylandDisplay(): string | undefined {
	return (globalThis as GlobalWaylandEnv)[WAYLAND_ENV_KEY];
}

export function shouldPreferXWayland(
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env
): boolean {
	if (platform !== 'linux') return false;
	if (env.KILO_WAYLAND === '1') return false;
	if (!env.WAYLAND_DISPLAY || !env.DISPLAY) return false;
	return /gnome/i.test(env.XDG_CURRENT_DESKTOP ?? '');
}

function unsetNativeEnv(name: string): boolean {
	const key = Buffer.from(`${name}\0`);
	for (const candidate of ['libc.so.6', 'libc.musl-x86_64.so.1', 'libc.musl-aarch64.so.1']) {
		let lib: ReturnType<typeof dlopen<{ unsetenv: { args: [typeof FFIType.cstring]; returns: typeof FFIType.i32 } }>> | null = null;
		try {
			lib = dlopen(candidate, {
				unsetenv: { args: [FFIType.cstring], returns: FFIType.i32 }
			} as const);
			return lib.symbols.unsetenv(key) === 0;
		} catch {
			// Try the next standard C library soname.
		} finally {
			lib?.close();
		}
	}
	return false;
}

export function prepareLinuxTitlebar(): boolean {
	if (!shouldPreferXWayland()) return false;
	const original = Bun.env.WAYLAND_DISPLAY;
	if (!original) return false;
	if (!unsetNativeEnv('WAYLAND_DISPLAY')) return false;
	if (Bun.env.WAYLAND_SOCKET) {
		unsetNativeEnv('WAYLAND_SOCKET');
		delete Bun.env.WAYLAND_SOCKET;
	}
	(globalThis as GlobalWaylandEnv)[WAYLAND_ENV_KEY] = original;
	delete Bun.env.WAYLAND_DISPLAY;
	return true;
}

// The in-app theme is independent of Windows, so the native caption, caption
// text and border are painted to the same palette the panes use.
const DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
const DWMWA_BORDER_COLOR = 34;
const DWMWA_CAPTION_COLOR = 35;
const DWMWA_TEXT_COLOR = 36;

type Win32Titlebar = {
	paint: (dark: boolean, background: string, ink: string, border: string) => boolean;
};

let win32: Win32Titlebar | null | 'unavailable' = null;
let initPromise: Promise<Win32Titlebar | null> | null = null;

function colorref(hex: string) {
	const value = Number.parseInt(hex.slice(1, 7), 16);
	const red = (value >> 16) & 255;
	const green = (value >> 8) & 255;
	const blue = value & 255;
	return (blue << 16) | (green << 8) | red;
}

async function initWin32(): Promise<Win32Titlebar | null> {
	try {
		const user32 = dlopen('user32.dll', {
			EnumWindows: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
			GetWindowThreadProcessId: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.u32 },
			GetClassNameW: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
			IsWindow: { args: [FFIType.ptr], returns: FFIType.i32 }
		} as const);

		const kernel32 = dlopen('kernel32.dll', {
			GetCurrentProcessId: { args: [], returns: FFIType.u32 }
		} as const);

		const dwmapi = dlopen('dwmapi.dll', {
			DwmSetWindowAttribute: {
				args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.u32],
				returns: FFIType.i32
			}
		} as const);

		const pidBuf = Buffer.alloc(4);
		const classBuf = Buffer.alloc(64);
		const attrBuf = Buffer.alloc(4);
		const myPid = kernel32.symbols.GetCurrentProcessId();

		let hwnd: bigint | null = null;
		let found: bigint | null = null;

		const enumerate = new JSCallback(
			(handle: bigint) => {
				user32.symbols.GetWindowThreadProcessId(handle, ptr(pidBuf));
				if (pidBuf.readUInt32LE(0) !== myPid) return 1;
				const length = user32.symbols.GetClassNameW(handle, ptr(classBuf), 31);
				if (length > 0 && classBuf.toString('utf16le', 0, length * 2) === 'Zed::Window') {
					found = handle;
					return 0;
				}
				return 1;
			},
			{ args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 }
		);

		const windowHandle = () => {
			if (hwnd !== null && user32.symbols.IsWindow(hwnd)) return hwnd;
			found = null;
			user32.symbols.EnumWindows(enumerate.ptr, 0n);
			hwnd = found;
			return hwnd;
		};

		const setAttr = (handle: bigint, attribute: number, value: number) => {
			attrBuf.writeUInt32LE(value >>> 0, 0);
			dwmapi.symbols.DwmSetWindowAttribute(handle, attribute, ptr(attrBuf), 4);
		};

		const instance: Win32Titlebar = {
			paint(dark, background, ink, border) {
				const handle = windowHandle();
				if (handle === null) return false;
				setAttr(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, dark ? 1 : 0);
				setAttr(handle, DWMWA_CAPTION_COLOR, colorref(background));
				setAttr(handle, DWMWA_TEXT_COLOR, colorref(ink));
				setAttr(handle, DWMWA_BORDER_COLOR, colorref(border));
				return true;
			}
		};
		win32 = instance;
		return instance;
	} catch {
		win32 = 'unavailable';
		return null;
	}
}

async function ensureWin32(): Promise<Win32Titlebar | null> {
	if (win32 === 'unavailable') return null;
	if (win32 !== null) return win32;
	if (!initPromise) initPromise = initWin32();
	return initPromise;
}

export async function syncTitlebar(
	dark: boolean,
	background: string,
	ink: string,
	border: string
): Promise<boolean> {
	if (process.platform !== 'win32') return true;
	const state = await ensureWin32();
	if (!state) return true;
	return state.paint(dark, background, ink, border);
}
