import path from 'node:path';

export { copyFilePath, copyFilePaths, hasClipboardSupport } from './clipboard.ts';

const isEnoent = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const spawnDetached = (cmd: string[], windowsHide?: boolean): void => {
	Bun.spawn(cmd, {
		detached: true,
		stdin: 'ignore',
		stdout: 'ignore',
		stderr: 'ignore',
		...(windowsHide !== undefined ? { windowsHide } : {})
	}).unref();
};

export const revealPath = (filepath: string) => {
	if (process.platform === 'win32') {
		spawnDetached(['explorer.exe', `/select,${filepath}`], false);
		return;
	}
	if (process.platform === 'darwin') {
		spawnDetached(['open', '-R', filepath]);
		return;
	}
	spawnDetached(['xdg-open', path.dirname(filepath)]);
};

export const openExternal = (url: string): void => {
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
	}
	if (process.platform === 'win32') {
		spawnDetached(['rundll32.exe', 'url.dll,FileProtocolHandler', parsed.href], true);
		return;
	}
	if (process.platform === 'darwin') {
		spawnDetached(['open', parsed.href]);
		return;
	}
	spawnDetached(['xdg-open', parsed.href]);
};

const runExecFile = async (command: string, args: string[], env?: Record<string, string>) => {
	const proc = Bun.spawn([command, ...args], {
		stdin: 'ignore',
		stdout: 'ignore',
		stderr: 'pipe',
		windowsHide: true,
		...(env ? { env: { ...Bun.env, ...env } } : {})
	});
	const [code, stderrText] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
	if (code !== 0) {
		throw new Error(stderrText.trim() || `${command} exited with code ${code}.`);
	}
};

export const trashPath = async (filepath: string) => {
	if (process.platform === 'win32') {
		const script =
			"$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:KILO_TRASH_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')";
		const args = ['-NoProfile', '-NonInteractive', '-Command', script];
		try {
			await runExecFile('powershell.exe', args, { KILO_TRASH_PATH: filepath });
		} catch (error) {
			if (isEnoent(error)) {
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
		if (isEnoent(error)) {
			await runExecFile('trash-put', [filepath]);
			return;
		}
		throw error;
	}
};
