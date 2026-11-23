import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

export { copyFilePath, copyFilePaths, hasClipboardSupport } from './clipboard.ts';

const execFileAsync = promisify(execFile);

export const revealPath = (filepath: string) => {
	if (process.platform === 'win32') {
		spawn('explorer.exe', [`/select,${filepath}`], { detached: true, windowsHide: false }).unref();
		return;
	}
	if (process.platform === 'darwin') {
		spawn('open', ['-R', filepath], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	spawn('xdg-open', [path.dirname(filepath)], { detached: true, stdio: 'ignore' }).unref();
};

export const openExternal = (url: string): void => {
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
	}
	if (process.platform === 'win32') {
		spawn('rundll32.exe', ['url.dll,FileProtocolHandler', parsed.href], {
			detached: true,
			windowsHide: true,
			stdio: 'ignore'
		}).unref();
		return;
	}
	if (process.platform === 'darwin') {
		spawn('open', [parsed.href], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	spawn('xdg-open', [parsed.href], { detached: true, stdio: 'ignore' }).unref();
};

const runExecFile = (command: string, args: string[], env?: Record<string, string>) =>
	execFileAsync(command, args, {
		windowsHide: true,
		...(env ? { env: { ...process.env, ...env } } : {})
	});

export const trashPath = async (filepath: string) => {
	if (process.platform === 'win32') {
		const script =
			"$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:KILO_TRASH_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')";
		const args = ['-NoProfile', '-NonInteractive', '-Command', script];
		try {
			await runExecFile('powershell.exe', args, { KILO_TRASH_PATH: filepath });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				await runExecFile('pwsh', args, { KILO_TRASH_PATH: filepath });
				return;
			}
			throw error;
		}
		return;
	}
	if (process.platform === 'darwin') {
		const script = `tell application "Finder" to delete POSIX file ${JSON.stringify(filepath)}`;
		await runExecFile('osascript', ['-e', script]);
		return;
	}
	try {
		await runExecFile('gio', ['trash', filepath]);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			await runExecFile('trash-put', [filepath]);
			return;
		}
		throw error;
	}
};
