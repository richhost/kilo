<script lang="ts">
	import type { Snippet } from 'svelte';
	import Popover from 'gpuix-svelte/components/Popover.svelte';
	import Kbd from 'gpuix-svelte-ui/components/Kbd.svelte';
	import { activates } from 'gpuix-svelte-ui/keys';
	import { aria_disabled, own_hitbox, test_id, type MenuEntry } from 'gpuix-svelte-ui/shared';
	import { menuMotion } from './motion.ts';

	let {
		open,
		onclose,
		items,
		children,
		side = 'bottom',
		align = 'start',
		gap = 4,
		position = null,
		testid = null
	}: {
		open: boolean;
		/** A press outside, Escape, or an item that ran. */
		onclose: () => void;
		items: MenuEntry[];
		/** The trigger; it toggles `open` itself. */
		children: Snippet;
		side?: 'top' | 'right' | 'bottom' | 'left';
		align?: 'start' | 'center' | 'end';
		gap?: number;
		/** Window coordinates to open at instead of beside the trigger, for a context menu. */
		position?: { x: number; y: number } | null;
		/** The trigger wrapper's id; the panel gets `<testid>-panel` and each item `<testid>-<label slug>`. */
		testid?: string | null;
	} = $props();

	let held = $state(false);
	let visible = $state(false);

	const motion = $derived(menuMotion(visible));

	$effect(() => {
		if (open) {
			held = true;
			visible = true;
			return;
		}
		visible = false;
	});

	function rest() {
		if (visible) return;
		held = false;
	}

	const slug = (label: string) =>
		label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

	function select(entry: MenuEntry) {
		if (!open || entry.separator || entry.disabled) return;
		entry.onselect?.();
		onclose();
	}
</script>

<Popover
	open={held}
	{onclose}
	{side}
	{align}
	{gap}
	{position}
	{testid}
	style="padding: 0; border-width: 0; background-color: transparent;"
>
	{@render children()}
	{#snippet content()}
		<div class="menu" class:closing={!visible} role="menu" {motion} onmotioncomplete={rest}>
			{#each items as entry, i (i)}
				{#if entry.separator}
					<div class="separator"></div>
				{:else}
					<div
						class="item"
						class:disabled={entry.disabled}
						class:danger={entry.danger}
						role="menuitem"
						tabindex={entry.disabled ? -1 : 0}
						{...aria_disabled(entry.disabled)}
						{...own_hitbox}
						{...test_id(testid ? `${testid}-${slug(entry.label)}` : null)}
						onclick={() => select(entry)}
						onkeydown={(e) => activates(e) && select(entry)}
					>
						<div class="item-label">{entry.label}</div>
						{#if entry.shortcut}<Kbd>{entry.shortcut}</Kbd>{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/snippet}
</Popover>

<style>
	.menu {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 160px;
		padding: 4px;
		border-radius: 10px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border-strong);
		box-sizing: border-box;
		background-color: var(--surface-selected);
	}
	.menu.closing {
		pointer-events: none;
	}
	.item {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 6px 8px;
		border-radius: 7px;
		font-size: 13px;
		line-height: 18px;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		color: var(--ui-ink);
	}
	.item:hover {
		background-color: var(--ui-raised-hover);
	}
	.item:focus-visible {
		background-color: var(--ui-raised-hover);
	}
	.item:active {
		background-color: var(--ui-border-strong);
	}
	.item.danger {
		color: var(--ui-danger);
	}
	.item.danger:hover {
		background-color: var(--ui-danger-wash);
	}
	.item.danger:active {
		opacity: 0.8;
	}
	.item.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.separator {
		height: 1px;
		margin: 4px 6px;
		background-color: var(--ui-border);
	}
</style>
