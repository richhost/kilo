<script lang="ts">
	import { set_image, type GpuixEvent, type ShadowNode } from 'gpuix-svelte';
	import { Icon, Tooltip } from 'gpuix-svelte-ui';
	import { bytes, isSamePath, parentFolderName, savedPercent } from '../core/paths.ts';
	import type { Row } from '../core/types.ts';
	import { hasClipboardSupport } from '../platform/desktop.ts';
	import { copyFile, deleteOutput, removeRow, retryRow, showFile } from '../state/actions.ts';
	import { getThumb } from '../state/thumbs.ts';
	import FadeMenu from './FadeMenu.svelte';
	import { APP_ICONS } from './icons.ts';
	import PillButton from './PillButton.svelte';

	const { file }: { file: Row } = $props();

	let open = $state(false);
	let menuPos = $state<{ x: number; y: number } | null>(null);
	let ready = $state(false);
	let image: ShadowNode | null = null;
	const canCopy = hasClipboardSupport();

	const filepath = $derived(file.filepath);
	const name = $derived(file.filepath.split(/[/\\]/).pop() ?? file.filepath);
	const parentDir = $derived(parentFolderName(file.filepath));
	const overwritesSource = $derived(isSamePath(file.filepath, file.outputPath));
	const percent = $derived(
		file.status === 'completed' ? savedPercent(file.fileSize, file.outSize) : null
	);

	const extLabel = (ext: string) => {
		const key = ext.toLowerCase();
		if (key === 'jpg' || key === 'jpeg') return 'JPG';
		if (key === 'png') return 'PNG';
		if (key === 'webp') return 'WebP';
		if (key === 'avif') return 'AVIF';
		if (key === 'gif') return 'GIF';
		return ext.toUpperCase();
	};

	const fromLabel = $derived(extLabel(file.extname));
	const toLabel = $derived(extLabel(file.targetExtname));
	const converted = $derived(fromLabel !== toLabel);
	const percentLabel = $derived.by(() => {
		if (percent === null) return '';
		const abs = Math.abs(percent);
		if (percent > 0) return `−${abs}%`;
		if (percent < 0) return `+${abs}%`;
		return '0%';
	});

	const openContextMenu = (e: GpuixEvent) => {
		if (e.x === undefined || e.y === undefined) return;
		menuPos = { x: e.x, y: e.y };
		open = true;
	};

	const items = $derived([
		{
			label: 'Show in folder',
			disabled: file.status !== 'completed',
			onselect: () => showFile(file)
		},
		{
			label: 'Copy',
			disabled: file.status !== 'completed' || !canCopy,
			onselect: () => copyFile(file)
		},
		{
			label: 'Retry',
			disabled: file.status === 'processing',
			onselect: () => retryRow(file)
		},
		{ label: 'Remove', onselect: () => removeRow(file) },
		{ separator: true as const },
		{
			label: 'Delete',
			danger: true,
			disabled: file.status !== 'completed' || overwritesSource,
			onselect: () => deleteOutput(file)
		}
	]);

	$effect(() => {
		if (!ready || !image) return;
		const targetPath = filepath;
		const node = image;
		let alive = true;
		void getThumb(targetPath).then((thumb) => {
			if (alive && thumb) set_image(node, thumb);
		});
		return () => {
			alive = false;
		};
	});
</script>

<div
	class="row"
	class:open
	onauxclick={(e) => {
		if (e.button === 2) openContextMenu(e);
	}}
	onclick={(e) => {
		if (e.modifiers?.ctrl) openContextMenu(e);
	}}
>
	<div class="frame">
		<img
			class="thumb"
			alt=""
			{@attach (node) => {
				image = node;
				ready = true;
				return () => {
					image = null;
					ready = false;
				};
			}}
		/>
	</div>

	<div class="meta">
		<div class="title">
			<div class="name">{name}</div>
			{#if parentDir}
				<div class="folder">{parentDir}</div>
			{/if}
		</div>
		<div class="sub">
			<div class="fmt">{fromLabel}</div>
			<div class="fmt">→</div>
			<div class="fmt" class:changed={converted}>{toLabel}</div>
			{#if file.status === 'failed'}
				<div class="fail">{file.error || 'Failed'}</div>
			{/if}
		</div>
	</div>

	<div class="result">
		{#if file.status === 'completed'}
			<div class="sizes">{bytes(file.fileSize)} → {bytes(file.outSize)}</div>
			<div
				class="pill"
				class:saved={percent !== null && percent > 0}
				class:grew={percent !== null && percent < 0}
			>
				{percentLabel}
			</div>
		{:else if file.status === 'failed'}
			<PillButton size="sm" variant="soft" onclick={() => retryRow(file)}>
				<Icon source={APP_ICONS.refresh} size={13} />
				Retry
			</PillButton>
		{:else}
			<div class="wait-pill">Working</div>
		{/if}
	</div>

	<div class="row-actions">
		{#if file.status === 'completed'}
			<Tooltip content="Show in folder" side="top" align="end">
				{#snippet children(hover, focus)}
					<PillButton
						size="sm"
						shape="circle"
						variant="ghost"
						label="Show in folder"
						onclick={() => showFile(file)}
						{...hover}
						{...focus}
					>
						<Icon source={APP_ICONS.folder} size={14} />
					</PillButton>
				{/snippet}
			</Tooltip>
		{/if}

		<FadeMenu
			{open}
			{items}
			position={menuPos}
			onclose={() => {
				open = false;
				menuPos = null;
			}}
			align="end"
		>
			<PillButton
				size="sm"
				shape="circle"
				variant="ghost"
				label="File actions"
				onclick={() => {
					menuPos = null;
					open = !open;
				}}
			>
				<Icon source={APP_ICONS.more} size={14} />
			</PillButton>
		</FadeMenu>
	</div>
</div>

<style>
	.row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		margin-bottom: 3px;
		padding: 8px 10px;
		border-radius: 9px;
	}
	.row:hover {
		background-color: var(--ui-raised);
	}
	.open {
		background-color: var(--ui-raised);
	}
	.open:hover {
		background-color: var(--ui-raised);
	}
	.frame {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border);
		flex-shrink: 0;
		overflow: hidden;
		background-color: var(--ui-raised);
	}
	.thumb {
		width: 36px;
		height: 36px;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex-grow: 1;
		width: 0;
		min-width: 0;
	}
	.title {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		min-width: 0;
		overflow: hidden;
	}
	.name {
		flex-shrink: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ui-ink);
	}
	.folder {
		flex-shrink: 0;
		max-width: 140px;
		overflow: hidden;
		font-size: 11px;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ui-muted);
	}
	.sub {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 4px;
		min-width: 0;
		overflow: hidden;
	}
	.fmt {
		flex-shrink: 0;
		font-family: var(--ui-mono);
		font-size: 11px;
		white-space: nowrap;
		color: var(--ui-muted);
	}
	.changed {
		font-weight: 600;
		color: var(--ui-ink);
	}
	.result {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.row-actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}
	.sizes {
		flex-shrink: 0;
		font-family: var(--ui-mono);
		font-size: 12px;
		white-space: nowrap;
		color: var(--ui-muted);
	}
	.pill,
	.wait-pill {
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
	.saved {
		background-color: var(--ui-success-wash);
		color: var(--ui-success);
	}
	.grew {
		background-color: var(--ui-warning-wash);
		color: var(--ui-warning);
	}
	.fail {
		flex-grow: 1;
		width: 0;
		overflow: hidden;
		font-size: 11px;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ui-danger);
	}
</style>
