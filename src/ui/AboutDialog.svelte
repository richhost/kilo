<script lang="ts">
	import { readFileSync } from 'node:fs';
	import { app_info, check_for_update, type Update } from 'gpuix-svelte/update';
	import { Dialog, Icon, toast } from 'gpuix-svelte-ui';
	import { activates } from 'gpuix-svelte-ui/keys';
	import { openExternal } from '../platform/desktop.ts';
	import PillButton from './PillButton.svelte';
	import { APP_ICONS } from './icons.ts';

	const RELEASES_URL = 'https://github.com/richhost/pixzip-lite/releases';

	const readVersion = (): string => {
		const embedded = app_info()?.version;
		if (typeof embedded === 'string' && embedded.trim().length > 0) {
			return embedded.trim();
		}
		try {
			const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
			const parsed = JSON.parse(raw) as { version?: unknown };
			if (typeof parsed.version === 'string' && parsed.version.trim().length > 0) {
				return parsed.version.trim();
			}
		} catch {
			// Ignore missing package.json outside repo without embedded metadata.
		}
		return '0.0.0';
	};

	const {
		open,
		onclose
	}: {
		open: boolean;
		onclose: () => void;
	} = $props();

	const version = readVersion();

	let checking = $state(false);
	let checked = $state(false);
	let inAppUpdate = $state<Update | null>(null);
	let installing = $state(false);
	let installProgress = $state<number | null>(null);
	let errorText = $state<string | null>(null);
	let requestSeq = 0;

	const openLink = (url: string) => {
		try {
			openExternal(url);
		} catch (error) {
			toast({
				title: 'Could not open link',
				description: error instanceof Error ? error.message : String(error),
				tone: 'danger'
			});
		}
	};

	const runCheck = async () => {
		const seq = ++requestSeq;
		checking = true;
		checked = false;
		errorText = null;
		try {
			const update = await check_for_update();
			if (seq !== requestSeq) return;
			inAppUpdate = update;
			checked = true;
		} catch (error) {
			if (seq !== requestSeq) return;
			inAppUpdate = null;
			checked = true;
			errorText = error instanceof Error ? error.message : 'Failed to check updates';
		} finally {
			if (seq === requestSeq) {
				checking = false;
			}
		}
	};

	const installInAppUpdate = async () => {
		if (!inAppUpdate || installing) return;
		installing = true;
		installProgress = null;
		errorText = null;
		try {
			await inAppUpdate.download({
				onProgress: (received, total) => {
					installProgress = total ? received / total : null;
				}
			});
			await inAppUpdate.install();
		} catch (error) {
			installing = false;
			errorText = error instanceof Error ? error.message : 'Failed to install update';
		}
	};

	$effect(() => {
		if (!open) {
			requestSeq++;
			installing = false;
			installProgress = null;
			return;
		}
		void runCheck();
		return () => {
			requestSeq++;
		};
	});

	const openSourceLinks = [
		{ name: 'Kilo', url: 'https://github.com/richhost/pixzip-lite' },
		{ name: 'Svelte', url: 'https://github.com/sveltejs/svelte' },
		{ name: 'gpuix-svelte', url: 'https://github.com/khromov/gpuix-svelte' },
		{ name: 'sharp', url: 'https://github.com/lovell/sharp' },
		{ name: 'Allo', url: 'https://allo.joshpuckett.me/' }
	];
</script>

<Dialog size="md" testid="about-dialog" {open} {onclose} title="About Kilo">
	<div class="sheet">
		<div class="identity">
			<div class="identity-left">
				<div class="mark">
					<Icon source={APP_ICONS.logo} size={20} />
				</div>
				<div class="identity-copy">
					<div class="name">Kilo</div>
					<div class="tagline">Local batch image compression</div>
				</div>
			</div>
			<div class="version">v{version}</div>
		</div>

		<div class="status" class:raised={inAppUpdate !== null && !checking}>
			<div class="status-main">
				{#if checking}
					<div class="muted">Checking for updates…</div>
				{:else if inAppUpdate}
					<div class="update-text">v{inAppUpdate.version} is available</div>
					{#if errorText}
						<div class="err">{errorText}</div>
					{/if}
				{:else if errorText}
					<div class="err">{errorText}</div>
				{:else if checked}
					<div class="ok-line">
						<div class="dot"></div>
						<div class="ok">Up to date</div>
					</div>
				{/if}
			</div>
			<div class="status-actions">
				{#if inAppUpdate && !checking}
					{#if inAppUpdate.installable}
						<PillButton
							size="sm"
							variant="ink"
							testid="about-install-update"
							disabled={installing}
							onclick={() => void installInAppUpdate()}
						>
							{installing
								? installProgress === null
									? 'Downloading…'
									: `${Math.round(installProgress * 100)}%`
								: 'Install & restart'}
						</PillButton>
					{:else}
						<PillButton
							size="sm"
							variant="ink"
							onclick={() => openLink(inAppUpdate?.url || RELEASES_URL)}
						>
							Download
						</PillButton>
					{/if}
				{/if}
				<PillButton
					size="sm"
					variant={inAppUpdate && !checking ? 'ghost' : 'soft'}
					testid="about-check-update"
					disabled={checking || installing}
					onclick={() => void runCheck()}
				>
					Check again
				</PillButton>
			</div>
		</div>

		<div class="promise">
			All compression runs locally on your device. Images and data never leave your machine.
		</div>

		<div class="meta">
			<div class="group">
				<div class="label">Open source</div>
				<div class="sources">
					{#each openSourceLinks as item, i (item.name)}
						{#if i > 0}
							<div class="middot">·</div>
						{/if}
						<div
							class="source"
							role="link"
							tabindex="0"
							onclick={() => openLink(item.url)}
							onkeydown={(e) => activates(e) && openLink(item.url)}
						>
							{item.name}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	{#snippet actions()}
		<PillButton size="sm" variant="soft" testid="about-close" onclick={onclose}>Close</PillButton>
	{/snippet}
</Dialog>

<style>
	.sheet {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.identity {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.identity-left {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 11px;
		flex-shrink: 0;
		background-color: var(--ui-ink);
		color: var(--ui-bg);
	}
	.identity-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
		line-height: 20px;
		color: var(--ui-ink);
	}
	.tagline {
		font-size: 12.5px;
		line-height: 17px;
		color: var(--ui-muted);
	}
	.version {
		flex-shrink: 0;
		padding: 3px 9px;
		border-radius: 999px;
		font-family: var(--ui-mono);
		font-size: 11.5px;
		line-height: 16px;
		background-color: var(--ui-raised);
		color: var(--ui-muted);
	}
	.status {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 30px;
		padding: 8px 8px 8px 12px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border);
		border-radius: 10px;
	}
	.status.raised {
		background-color: var(--ui-raised);
	}
	.status-main {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		width: 0;
		gap: 2px;
		min-width: 0;
	}
	.status-actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.ok-line {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		flex-shrink: 0;
		background-color: var(--ui-success);
	}
	.ok {
		font-size: 13px;
		font-weight: 500;
		line-height: 18px;
		color: var(--ui-ink);
	}
	.update-text {
		font-size: 13px;
		font-weight: 600;
		line-height: 18px;
		color: var(--ui-ink);
	}
	.muted,
	.err {
		font-size: 13px;
		line-height: 18px;
	}
	.muted {
		color: var(--ui-muted);
	}
	.err {
		color: var(--ui-danger);
	}
	.promise {
		font-size: 12.5px;
		line-height: 18px;
		color: var(--ui-muted);
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 14px;
		border-top-width: 1px;
		border-top-style: solid;
		border-top-color: var(--ui-border);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.label {
		font-size: 12px;
		font-weight: 500;
		line-height: 16px;
		color: var(--ui-muted);
	}
	.sources {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
	}
	.middot {
		padding: 0 7px;
		font-size: 12.5px;
		line-height: 18px;
		color: var(--ui-border-strong);
	}
	.source {
		padding: 2px 0;
		font-size: 12.5px;
		font-weight: 500;
		line-height: 18px;
		color: var(--ui-ink);
		cursor: pointer;
		user-select: none;
	}
	.source:hover,
	.source:focus-visible {
		text-decoration: underline;
	}
</style>
