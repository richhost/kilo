<script lang="ts">
	import type { GpuixEvent } from 'gpuix-svelte';
	import { Icon, Popover, Tooltip } from 'gpuix-svelte-ui';
	import { activates } from 'gpuix-svelte-ui/keys';
	import type { Space } from '../core/types.ts';
	import { removeSpace } from '../state/actions.ts';
	import {
		addSpace,
		duplicateSpace,
		rowsOf,
		selectSpace,
		setDark,
		ui
	} from '../state/spaces.svelte.ts';
	import AboutDialog from './AboutDialog.svelte';
	import FadeMenu from './FadeMenu.svelte';
	import { APP_ICONS } from './icons.ts';
	import { dropdownMotion } from './motion.ts';
	import PillButton from './PillButton.svelte';
	import ScrollArea from './ScrollArea.svelte';

	let aboutOpen = $state(false);
	let deleteTargetId = $state<string | null>(null);
	let deleteLabel = $state('Space');
	let deletePopoverPos = $state<{ x: number; y: number } | null>(null);
	let deleteHeld = $state(false);
	let deleteVisible = $state(false);
	let spaceMenuOpen = $state(false);
	let spaceMenuPos = $state<{ x: number; y: number } | null>(null);
	let spaceMenuId = $state<string | null>(null);
	const isMac = process.platform === 'darwin';

	const closeDeletePopover = () => {
		deleteTargetId = null;
		deletePopoverPos = null;
	};

	const stageDelete = (id: string, pos: { x: number; y: number } | null) => {
		const space = ui.spaces.find((item) => item.id === id);
		deleteLabel = space?.name || 'Space';
		deletePopoverPos = pos;
		deleteTargetId = id;
	};

	$effect(() => {
		if (deleteTargetId !== null) {
			deleteHeld = true;
			deleteVisible = true;
			return;
		}
		deleteVisible = false;
	});

	const restDelete = () => {
		if (deleteVisible) return;
		deleteHeld = false;
	};

	const deleteOffsetY = $derived(deletePopoverPos ? -4 : 4);
	const deleteMotion = $derived(dropdownMotion(deleteVisible, deleteOffsetY));

	const confirmDeleteSpace = () => {
		const targetId = deleteTargetId;
		closeDeletePopover();
		if (targetId) removeSpace(targetId);
	};

	const formatLabels: Record<Space['format'], string> = {
		original: 'Original',
		avif: 'AVIF',
		webp: 'WebP',
		png: 'PNG',
		jpg: 'JPG'
	};

	const spaceSummary = (space: Space): string => {
		const sizeText =
			space.width && space.height
				? `${space.width}×${space.height}`
				: space.width
					? `${space.width}w`
					: space.height
						? `${space.height}h`
						: '';
		return [formatLabels[space.format], `L${space.level}`, sizeText].filter(Boolean).join(' · ');
	};

	const openSpaceMenu = (id: string, e: GpuixEvent) => {
		if (e.x === undefined || e.y === undefined) return;
		spaceMenuId = id;
		spaceMenuPos = { x: e.x, y: e.y };
		spaceMenuOpen = true;
	};

	const spaceMenuItems = $derived([
		{
			label: 'Duplicate',
			onselect: () => {
				if (spaceMenuId) duplicateSpace(spaceMenuId);
			}
		},
		{ separator: true as const },
		{
			label: 'Delete',
			danger: true,
			disabled: ui.spaces.length === 1,
			onselect: () => {
				if (!spaceMenuId) return;
				stageDelete(spaceMenuId, spaceMenuPos ? { ...spaceMenuPos } : null);
			}
		}
	]);
</script>

<div class="side">
	<div class="brand">
		{#if isMac}
			<div class="spacer"></div>
		{:else}
			<div class="title">Spaces</div>
		{/if}
		<Tooltip content={ui.dark ? 'Switch to light' : 'Switch to dark'} side="bottom" align="end">
			{#snippet children(hover, focus)}
				<PillButton
					size="sm"
					shape="circle"
					variant="ghost"
					testid="toggle-theme"
					label={ui.dark ? 'Switch to light' : 'Switch to dark'}
					onclick={() => setDark(!ui.dark)}
					{...hover}
					{...focus}
				>
					<Icon source={ui.dark ? APP_ICONS.sun : APP_ICONS.moon} size={14} />
				</PillButton>
			{/snippet}
		</Tooltip>
	</div>

	{#if isMac}
		<div class="section-head">Spaces</div>
	{/if}

	<ScrollArea gap={4} pad={isMac ? '6px 10px 10px' : '10px'}>
		{#each ui.spaces as space (space.id)}
			{@const count = rowsOf(space.id).length}
			{@const selected = space.id === ui.currentId}
			<div
				class="space"
				class:selected
				role="button"
				tabindex="0"
				testid={`space-${space.id}`}
				hitbox="self"
				onclick={(e) => {
					if (e.modifiers?.ctrl) {
						openSpaceMenu(space.id, e);
						return;
					}
					selectSpace(space.id);
				}}
				onkeydown={(e) => activates(e) && selectSpace(space.id)}
				onauxclick={(e) => {
					if (e.button === 2) openSpaceMenu(space.id, e);
				}}
			>
				<div class="space-top">
					<div class="name" class:name-on={selected}>{space.name || 'Space'}</div>
					{#if count > 0}
						<div class="count" class:count-on={selected}>{count}</div>
					{/if}
				</div>
				<div class="space-meta">{spaceSummary(space)}</div>
			</div>
		{/each}
	</ScrollArea>

	<FadeMenu
		open={spaceMenuOpen}
		items={spaceMenuItems}
		position={spaceMenuPos}
		onclose={() => {
			spaceMenuOpen = false;
			spaceMenuPos = null;
		}}
	>
		<div class="menu-anchor"></div>
	</FadeMenu>

	<div class="foot">
		<PillButton size="sm" variant="soft" testid="add-space" onclick={addSpace}>
			<Icon name="plus" size={13} />
			New space
		</PillButton>
		<div class="spacer"></div>
		<Popover
			open={deleteHeld}
			onclose={closeDeletePopover}
			side={deletePopoverPos ? 'bottom' : 'top'}
			align={deletePopoverPos ? 'start' : 'center'}
			gap={8}
			position={deletePopoverPos}
			testid="delete-space-popover"
			style="padding: 0; border-width: 0; background-color: transparent;"
		>
			<Tooltip
				content="Delete space"
				side="top"
				align="center"
				open={deleteHeld ? false : null}
			>
				{#snippet children(hover, focus)}
					<PillButton
						size="sm"
						shape="circle"
						variant="ghost"
						testid="delete-space"
						label="Delete space"
						disabled={ui.spaces.length === 1}
						onclick={() => {
							if (deleteTargetId === ui.currentId && deletePopoverPos === null) {
								closeDeletePopover();
							} else {
								stageDelete(ui.currentId, null);
							}
						}}
						{...hover}
						{...focus}
					>
						<Icon source={APP_ICONS.trash} size={14} />
					</PillButton>
				{/snippet}
			</Tooltip>
			{#snippet content()}
				<div
					class="confirm-pop"
					class:closing={!deleteVisible}
					motion={deleteMotion}
					onmotioncomplete={restDelete}
				>
					<div class="confirm-title">Delete space?</div>
					<div class="confirm-body">
						Remove "{deleteLabel}" and clear its queued files?
					</div>
					<div class="confirm-actions">
						<PillButton
							size="sm"
							variant="ghost"
							testid="delete-space-cancel"
							onclick={closeDeletePopover}
						>
							Cancel
						</PillButton>
						<PillButton
							size="sm"
							variant="danger"
							testid="delete-space-confirm"
							onclick={confirmDeleteSpace}
						>
							Delete
						</PillButton>
					</div>
				</div>
			{/snippet}
		</Popover>
		<Tooltip content="About" side="top" align="end" open={aboutOpen ? false : null}>
			{#snippet children(hover, focus)}
				<PillButton
					size="sm"
					shape="circle"
					variant="ghost"
					testid="open-about"
					label="About Kilo"
					onclick={() => (aboutOpen = true)}
					{...hover}
					{...focus}
				>
					<Icon name="info" size={14} />
				</PillButton>
			{/snippet}
		</Tooltip>
	</div>
</div>

<AboutDialog open={aboutOpen} onclose={() => (aboutOpen = false)} />

<style>
	.side {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		width: 208px;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background-color: var(--surface-sidebar);
		border-right-width: 1px;
		border-right-style: solid;
		border-right-color: var(--ui-border);
	}
	.brand {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		height: 48px;
		flex-shrink: 0;
		padding: 0 10px 0 14px;
		border-bottom-width: 1px;
		border-bottom-style: solid;
		border-bottom-color: var(--ui-border);
		background-color: var(--surface-sidebar);
	}
	.title {
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--ui-ink);
	}
	.section-head {
		flex-shrink: 0;
		padding: 10px 14px 2px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--ui-muted);
	}
	.space {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		border-width: 1px;
		border-style: solid;
		border-color: transparent;
		border-radius: 10px;
		cursor: pointer;
	}
	.space:hover {
		background-color: var(--ui-raised);
	}
	.space:active {
		background-color: var(--ui-raised-hover);
	}
	.space:focus-visible {
		outline-width: 2px;
		outline-color: var(--ui-ink);
		outline-offset: -2px;
	}
	.selected {
		background-color: var(--surface-selected);
		border-color: var(--ui-border);
	}
	.selected:hover {
		background-color: var(--surface-selected);
		border-color: var(--ui-border);
	}
	.space-top {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.name {
		flex-grow: 1;
		width: 0;
		overflow: hidden;
		font-size: 13px;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ui-ink);
	}
	.name-on {
		font-weight: 600;
	}
	.count {
		flex-shrink: 0;
		font-family: var(--ui-mono);
		font-size: 11px;
		color: var(--ui-muted);
	}
	.count-on {
		color: var(--ui-ink);
	}
	.space-meta {
		overflow: hidden;
		font-family: var(--ui-mono);
		font-size: 11px;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ui-muted);
	}
	.menu-anchor {
		width: 0;
		height: 0;
	}
	.foot {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 4px;
		height: 48px;
		flex-shrink: 0;
		padding: 0 10px;
		border-top-width: 1px;
		border-top-style: solid;
		border-top-color: var(--ui-border);
		background-color: var(--surface-sidebar);
	}
	.spacer {
		flex-grow: 1;
	}
	.confirm-pop {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 250px;
		padding: 12px;
		border-radius: 12px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border-strong);
		box-sizing: border-box;
		background-color: var(--surface-selected);
	}
	.confirm-pop.closing {
		pointer-events: none;
	}
	.confirm-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--ui-ink);
	}
	.confirm-body {
		font-size: 12px;
		line-height: 17px;
		color: var(--ui-muted);
	}
	.confirm-actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: end;
		gap: 6px;
		margin-top: 4px;
	}
</style>
