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
		const { dlopen, FFIType, JSCallback, ptr } = await import('bun:ffi');

		const user32 = dlopen('user32.dll', {
			EnumWindows: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
			GetWindowThreadProcessId: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.u32 },
			GetClassNameW: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
			IsWindow: { args: [FFIType.ptr], returns: FFIType.i32 }
		});

		const kernel32 = dlopen('kernel32.dll', {
			GetCurrentProcessId: { args: [], returns: FFIType.u32 }
		});

		const dwmapi = dlopen('dwmapi.dll', {
			DwmSetWindowAttribute: {
				args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.u32],
				returns: FFIType.i32
			}
		});

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
	const versions = process.versions as Record<string, string | undefined>;
	if (process.platform !== 'win32' || !versions.bun) return true;
	const state = await ensureWin32();
	if (!state) return true;
	return state.paint(dark, background, ink, border);
}
