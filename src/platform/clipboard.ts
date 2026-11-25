import path from 'node:path';
import { getOriginalWaylandDisplay } from './titlebar.ts';

const MAC_CLIPBOARD_JXA = `
ObjC.import('AppKit');
ObjC.import('Foundation');
const raw = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("KILO_CLIPBOARD_PATHS"));
const paths = JSON.parse(raw || "[]");
const urls = $.NSMutableArray.alloc.init;
for (const p of paths) {
  urls.addObject($.NSURL.fileURLWithPath(p));
}
const pb = $.NSPasteboard.generalPasteboard;
pb.clearContents;
if (!pb.writeObjects(urls)) {
  throw new Error("Failed to write file URLs to NSPasteboard.");
}
`;

// Win32 clipboard constants for CF_HDROP and movable zero-initialized global memory.
const CF_HDROP = 15;
const GHND = 0x0042;
const DROPFILES_SIZE = 20;

type Win32Clipboard = {
	writeFilePaths: (filepaths: string[]) => Promise<void>;
};

let win32Clipboard: Win32Clipboard | null | 'unavailable' = null;
let win32InitPromise: Promise<Win32Clipboard | null> | null = null;

function buildDropFilesPayload(filepaths: string[]): Buffer {
	const pathsBuffer = Buffer.from(`${filepaths.join('\0')}\0\0`, 'utf16le');
	const payload = Buffer.alloc(DROPFILES_SIZE + pathsBuffer.byteLength);
	payload.writeUInt32LE(DROPFILES_SIZE, 0); // pFiles
	payload.writeUInt32LE(1, 16); // fWide = TRUE (UTF-16LE)
	pathsBuffer.copy(payload, DROPFILES_SIZE);
	return payload;
}

const isEnoent = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

async function runCommand(
	command: string,
	args: string[],
	options?: { env?: Record<string, string | undefined>; windowsHide?: boolean }
): Promise<void> {
	const proc = Bun.spawn([command, ...args], {
		stdin: 'ignore',
		stdout: 'ignore',
		stderr: 'pipe',
		...(options?.env ? { env: options.env } : {}),
		...(options?.windowsHide !== undefined ? { windowsHide: options.windowsHide } : {})
	});
	const [code, stderrText] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
	if (code !== 0) {
		throw new Error(stderrText.trim() || `${command} exited with code ${code}.`);
	}
}

async function initWin32Clipboard(): Promise<Win32Clipboard | null> {
	try {
		const { dlopen, FFIType, ptr } = await import('bun:ffi');

		const user32 = dlopen('user32.dll', {
			OpenClipboard: { args: [FFIType.ptr], returns: FFIType.i32 },
			EmptyClipboard: { args: [], returns: FFIType.i32 },
			SetClipboardData: { args: [FFIType.u32, FFIType.ptr], returns: FFIType.ptr },
			CloseClipboard: { args: [], returns: FFIType.i32 }
		} as const);

		const kernel32 = dlopen('kernel32.dll', {
			GlobalAlloc: { args: [FFIType.u32, FFIType.u64], returns: FFIType.ptr },
			GlobalLock: { args: [FFIType.ptr], returns: FFIType.ptr },
			GlobalUnlock: { args: [FFIType.ptr], returns: FFIType.i32 },
			GlobalFree: { args: [FFIType.ptr], returns: FFIType.ptr },
			RtlMoveMemory: { args: [FFIType.ptr, FFIType.ptr, FFIType.u64], returns: FFIType.void }
		} as const);

		const instance: Win32Clipboard = {
			async writeFilePaths(filepaths) {
				const payload = buildDropFilesPayload(filepaths);
				const hMem = kernel32.symbols.GlobalAlloc(GHND, BigInt(payload.byteLength));
				if (!hMem) {
					throw new Error('GlobalAlloc failed while preparing clipboard data.');
				}

				const locked = kernel32.symbols.GlobalLock(hMem);
				if (!locked) {
					kernel32.symbols.GlobalFree(hMem);
					throw new Error('GlobalLock failed while preparing clipboard data.');
				}
				try {
					kernel32.symbols.RtlMoveMemory(locked, ptr(payload), BigInt(payload.byteLength));
				} finally {
					kernel32.symbols.GlobalUnlock(hMem);
				}

				let opened = false;
				for (let attempt = 0; attempt < 5; attempt++) {
					if (user32.symbols.OpenClipboard(0n) !== 0) {
						opened = true;
						break;
					}
					if (attempt < 4) await Bun.sleep(15);
				}
				if (!opened) {
					kernel32.symbols.GlobalFree(hMem);
					throw new Error('Could not open the Windows clipboard.');
				}

				// Once SetClipboardData succeeds, the OS owns hMem; only free on failure.
				let transferred = false;
				try {
					if (user32.symbols.EmptyClipboard() === 0) {
						throw new Error('Could not empty the Windows clipboard.');
					}
					if (!user32.symbols.SetClipboardData(CF_HDROP, hMem)) {
						throw new Error('Could not write file list to the Windows clipboard.');
					}
					transferred = true;
				} finally {
					user32.symbols.CloseClipboard();
					if (!transferred) {
						kernel32.symbols.GlobalFree(hMem);
					}
				}
			}
		};

		win32Clipboard = instance;
		return instance;
	} catch {
		win32Clipboard = 'unavailable';
		return null;
	}
}

async function ensureWin32Clipboard(): Promise<Win32Clipboard | null> {
	if (win32Clipboard === 'unavailable') return null;
	if (win32Clipboard !== null) return win32Clipboard;
	if (!win32InitPromise) win32InitPromise = initWin32Clipboard();
	return win32InitPromise;
}

async function copyWindowsFallback(filepaths: string[]): Promise<void> {
	const script =
		"$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Windows.Forms; $files = New-Object System.Collections.Specialized.StringCollection; foreach ($p in @(ConvertFrom-Json $env:KILO_CLIPBOARD_PATHS)) { [void]$files.Add([string]$p) }; [System.Windows.Forms.Clipboard]::SetFileDropList($files)";
	const args = ['-NoProfile', '-NonInteractive', '-STA', '-Command', script];
	const env = { ...Bun.env, KILO_CLIPBOARD_PATHS: JSON.stringify(filepaths) };
	try {
		await runCommand('powershell.exe', args, { windowsHide: true, env });
	} catch (error) {
		if (isEnoent(error)) {
			await runCommand('pwsh', args, { windowsHide: true, env });
			return;
		}
		throw error;
	}
}

type LinuxClipboardTool = 'wl-copy' | 'xclip';

function findLinuxClipboardTool(): LinuxClipboardTool | null {
	const waylandDisplay = Bun.env.WAYLAND_DISPLAY || getOriginalWaylandDisplay();
	const candidates: LinuxClipboardTool[] = waylandDisplay
		? ['wl-copy', 'xclip']
		: ['xclip', 'wl-copy'];
	return candidates.find((tool) => Bun.which(tool) !== null) ?? null;
}

async function writeToSpawnStdin(
	command: string,
	args: string[],
	input: string,
	env?: Record<string, string | undefined>
): Promise<void> {
	// Ignore stdout/stderr so clipboard daemons spawned by wl-copy/xclip do not keep the pipe open.
	const proc = Bun.spawn([command, ...args], {
		stdin: new TextEncoder().encode(input),
		stdout: 'ignore',
		stderr: 'ignore',
		...(env ? { env } : {})
	});
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`${command} exited with code ${code}.`);
	}
}

export const hasClipboardSupport = (): boolean => {
	if (process.platform === 'darwin' || process.platform === 'win32') return true;
	return Boolean(findLinuxClipboardTool());
};

export const copyFilePaths = async (filepaths: string[]): Promise<void> => {
	if (filepaths.length === 0) {
		throw new Error('At least one file path is required to copy to the clipboard.');
	}
	const resolved = filepaths.map((filepath) => path.resolve(filepath));

	if (process.platform === 'darwin') {
		await runCommand('osascript', ['-l', 'JavaScript', '-e', MAC_CLIPBOARD_JXA], {
			env: { ...Bun.env, KILO_CLIPBOARD_PATHS: JSON.stringify(resolved) }
		});
		return;
	}

	if (process.platform === 'win32') {
		const nativeClipboard = await ensureWin32Clipboard();
		if (nativeClipboard) {
			await nativeClipboard.writeFilePaths(resolved);
			return;
		}
		await copyWindowsFallback(resolved);
		return;
	}

	const tool = findLinuxClipboardTool();
	if (!tool) {
		throw new Error('Clipboard requires wl-copy or xclip on Linux.');
	}
	const uriList = `${resolved.map((p) => Bun.pathToFileURL(p).href).join('\r\n')}\r\n`;
	const args =
		tool === 'wl-copy'
			? ['--type', 'text/uri-list']
			: ['-selection', 'clipboard', '-t', 'text/uri-list', '-i'];
	const waylandDisplay = getOriginalWaylandDisplay();
	const spawnEnv =
		tool === 'wl-copy' && !Bun.env.WAYLAND_DISPLAY && waylandDisplay
			? { ...Bun.env, WAYLAND_DISPLAY: waylandDisplay }
			: undefined;
	await writeToSpawnStdin(tool, args, uriList, spawnEnv);
};

export const copyFilePath = (filepath: string): Promise<void> => copyFilePaths([filepath]);
