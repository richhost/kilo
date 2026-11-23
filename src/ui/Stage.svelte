<script lang="ts">
	import { set_image, type ShadowNode } from 'gpuix-svelte';
	import Scroller from 'gpuix-svelte/components/Scroller.svelte';
	import { Icon, Tooltip } from 'gpuix-svelte-ui';
	import { bytes, savedPercent } from '../core/paths.ts';
	import { clearCurrent, compressAgain, ingest, openFiles, openFolder } from '../state/actions.ts';
	import { currentSpace, rowsOf, ui } from '../state/spaces.svelte.ts';
	import FileRow from './FileRow.svelte';
	import PillButton from './PillButton.svelte';
	import { APP_ICONS, emptyIllustrationSvg } from './icons.ts';

	const space = $derived(currentSpace());
	const rows = $derived(space ? rowsOf(space.id) : []);
	const done = $derived(rows.filter((row) => row.status === 'completed'));
	const working = $derived(rows.filter((row) => row.status === 'processing').length);
	const failed = $derived(rows.filter((row) => row.status === 'failed').length);
	const before = $derived(done.reduce((sum, row) => sum + row.fileSize, 0));
	const after = $derived(done.reduce((sum, row) => sum + row.outSize, 0));
	const saved = $derived(done.length > 0 ? savedPercent(before, after) : 0);

	const mod = process.platform === 'darwin' ? '⌘' : 'Ctrl+';
	const shortcutHint = `${mod}O`;
	const folderShortcut = `${mod}Shift+O`;
	const compressShortcut = `${mod}Enter`;
	const illustrationBytes = $derived(new TextEncoder().encode(emptyIllustrationSvg(ui.dark)));

	let spotReady = $state(false);
	let spotNode: ShadowNode | null = null;

	$effect(() => {
		if (!spotReady || !spotNode) return;
		set_image(spotNode, illustrationBytes);
	});

	const savedText = (value: number) => {
		const abs = Math.abs(value);
		if (value > 0) return `−${abs}%`;
		if (value < 0) return `+${abs}%`;
		return '0%';
	};
</script>

<div class="stage" onfiledrop={(event) => ingest(event.paths ?? [])}>
	<div class="bar">
		<div class="actions">
			<Tooltip content={`Open files (${shortcutHint})`} side="bottom" align="start">
				{#snippet children(hover, focus)}
					<PillButton
						size="sm"
						variant={rows.length === 0 ? 'ghost' : 'soft'}
						testid="open-files"
						onclick={openFiles}
						{...hover}
						{...focus}
					>
						<Icon source={APP_ICONS.files} size={14} />
						Open files
					</PillButton>
				{/snippet}
			</Tooltip>
			<Tooltip content={`Open folder (${folderShortcut})`} side="bottom" align="start">
				{#snippet children(hover, focus)}
					<PillButton
						size="sm"
						variant="ghost"
						testid="open-folder"
						onclick={openFolder}
						{...hover}
						{...focus}
					>
						<Icon source={APP_ICONS.folder} size={14} />
						Folder
					</PillButton>
				{/snippet}
			</Tooltip>
		</div>
		<div class="stats">
			{#if rows.length > 0}
				<div class="stat">{rows.length} {rows.length === 1 ? 'file' : 'files'}</div>
				{#if working > 0}
					<div class="stat muted">{working} working</div>
				{/if}
				{#if failed > 0}
					<div class="stat failed">{failed} failed</div>
				{/if}
				{#if done.length > 0}
					<div class="stat muted">· {bytes(before)} → {bytes(after)}</div>
					<div class="delta" class:saved={saved > 0} class:grew={saved < 0}>{savedText(saved)}</div>
				{/if}
			{/if}
		</div>
		<div class="actions">
			<Tooltip content={`Compress all (${compressShortcut})`} side="bottom" align="end">
				{#snippet children(hover, focus)}
					<PillButton
						size="sm"
						testid="compress-btn"
						variant={rows.length > 0 ? 'ink' : 'soft'}
						disabled={rows.length === 0}
						onclick={compressAgain}
						{...hover}
						{...focus}
					>
						<Icon source={APP_ICONS.play} size={13} />
						Compress
					</PillButton>
				{/snippet}
			</Tooltip>
			<PillButton
				size="sm"
				variant="ghost"
				testid="clear-btn"
				disabled={rows.length === 0}
				onclick={clearCurrent}
			>
				Clear
			</PillButton>
		</div>
	</div>

	{#if rows.length === 0}
		<div class="empty">
			<div class="editorial">
				<div class="headline">
					<div class="headline-main">No images yet.</div>
					<div class="headline-sub">Drop images here</div>
				</div>
				<img
					class="spot"
					alt=""
					{@attach (node) => {
						spotNode = node;
						spotReady = true;
						return () => {
							spotNode = null;
							spotReady = false;
						};
					}}
				/>
				<div class="copy">
					Drag files or folders onto this canvas, or press {shortcutHint}. Supports JPG, PNG, WebP,
					AVIF, and GIF.
				</div>
				<div class="cta">
					<PillButton size="md" variant="ink" onclick={openFiles}>
						Open files
						<Icon source={APP_ICONS.arrowRight} size={14} />
					</PillButton>
				</div>
			</div>
		</div>
	{:else}
		<Scroller virtual estimate={58} pad="8px 14px">
			{#each rows as file (file.filepath)}
				<FileRow {file} />
			{/each}
		</Scroller>
	{/if}
</div>

<style>
	.stage {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		width: 0;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background-color: var(--surface-stage);
	}
	.bar {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 8px;
		height: 48px;
		flex-shrink: 0;
		padding: 0 14px;
		border-bottom-width: 1px;
		border-bottom-style: solid;
		border-bottom-color: var(--ui-border);
		background-color: var(--surface-stage);
	}
	.actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.stats {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: end;
		gap: 6px;
		flex-grow: 1;
		min-width: 0;
		overflow: hidden;
	}
	.stat {
		flex-shrink: 0;
		font-family: var(--ui-mono);
		font-size: 11px;
		white-space: nowrap;
		color: var(--ui-ink);
	}
	.stat.muted {
		color: var(--ui-muted);
	}
	.stat.failed {
		color: var(--ui-danger);
	}
	.delta {
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: 999px;
		font-family: var(--ui-mono);
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		background-color: var(--ui-raised);
		color: var(--ui-muted);
	}
	.delta.saved {
		background-color: var(--ui-success-wash);
		color: var(--ui-success);
	}
	.delta.grew {
		background-color: var(--ui-warning-wash);
		color: var(--ui-warning);
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-grow: 1;
		padding: 24px 32px 44px;
		background-color: var(--surface-stage);
	}
	.editorial {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 332px;
	}
	.headline {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.headline-main {
		font-size: 22px;
		line-height: 28px;
		font-weight: 600;
		color: var(--ui-ink);
	}
	.headline-sub {
		font-size: 22px;
		line-height: 28px;
		font-weight: 500;
		color: var(--ui-muted);
	}
	.spot {
		width: 184px;
		height: 136px;
		flex-shrink: 0;
		margin-top: 22px;
		margin-bottom: 16px;
	}
	.copy {
		font-size: 13px;
		line-height: 19px;
		color: var(--ui-muted);
		margin-bottom: 18px;
	}
	.cta {
		display: flex;
		flex-direction: row;
		align-items: center;
	}
</style>
