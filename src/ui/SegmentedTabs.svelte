<script lang="ts">
	import { activates, chorded, key_of, type KeyLike } from 'gpuix-svelte-ui/keys';
	import { aria_disabled, focus_node, own_hitbox, test_id, type Option } from 'gpuix-svelte-ui/shared';
	import { segmentMotion } from './motion.ts';

	let {
		items,
		value,
		onchange,
		label = null,
		disabled = false,
		testid = null
	}: {
		items: Option[];
		value: string;
		onchange: (value: string) => void;
		label?: string | null;
		disabled?: boolean;
		testid?: string | null;
	} = $props();

	let innerWidth = $state(0);
	const nodes: Record<string, unknown> = {};

	const enabled = (item: Option) => !disabled && !item.disabled;
	const stop = $derived(
		items.find((item) => item.value === value && enabled(item)) ?? items.find(enabled) ?? null
	);
	const activeIndex = $derived(items.findIndex((item) => item.value === value));
	const segWidth = $derived(items.length > 0 ? innerWidth / items.length : 0);
	const thumbMotion = $derived(segmentMotion(Math.max(0, activeIndex) * segWidth, segWidth));

	function choose(item: Option) {
		if (enabled(item) && item.value !== value) onchange(item.value);
	}

	function jump(item: Option) {
		choose(item);
		focus_node(nodes[item.value]);
	}

	function keydown(e: KeyLike, from: number) {
		if (chorded(e)) return;
		const key = key_of(e);
		if (key === 'home' || key === 'end') {
			e.preventDefault();
			const edge = key === 'home' ? items.find(enabled) : items.findLast(enabled);
			if (edge) jump(edge);
			return;
		}
		const delta = key === 'right' || key === 'down' ? 1 : key === 'left' || key === 'up' ? -1 : 0;
		if (delta === 0) {
			if (activates(e)) choose(items[from]);
			return;
		}
		e.preventDefault();
		for (let step = 1; step <= items.length; step++) {
			const next = items[(from + delta * step + items.length * step) % items.length];
			if (enabled(next)) {
				jump(next);
				return;
			}
		}
	}
</script>

<div class="track" class:disabled role="tablist" aria-label={label} {...test_id(testid)}>
	<div
		class="inner"
		onlayout={(e) => {
			const next = e.width ?? 0;
			if (next > 0 && Math.abs(next - innerWidth) > 0.25) innerWidth = next;
		}}
	>
		{#if innerWidth > 0 && activeIndex >= 0}
			<div class="thumb" motion={thumbMotion}></div>
		{/if}
		{#each items as item, i (item.value)}
			{@const active = item.value === value}
			<div
				class="tab"
				class:active
				class:fallback={active && innerWidth === 0}
				class:disabled={!enabled(item)}
				role="tab"
				aria-selected={active}
				tabindex={item === stop ? 0 : -1}
				{...aria_disabled(!enabled(item))}
				{...own_hitbox}
				{...test_id(testid ? `${testid}-${item.value}` : null)}
				{@attach (node: unknown) => {
					nodes[item.value] = node;
					return () => {
						delete nodes[item.value];
					};
				}}
				onclick={() => choose(item)}
				onkeydown={(e) => keydown(e, i)}
			>
				{item.label}
			</div>
		{/each}
	</div>
</div>

<style>
	.track {
		display: flex;
		flex-direction: row;
		width: 100%;
		height: 34px;
		padding: 3px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border);
		border-radius: 9px;
		box-sizing: border-box;
		background-color: var(--segment-track);
		user-select: none;
	}
	.track.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.inner {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		height: 100%;
	}
	.thumb {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 6px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--segment-thumb-border);
		box-sizing: border-box;
		background-color: var(--segment-thumb);
		pointer-events: none;
	}
	.tab {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		flex-grow: 1;
		flex-basis: 0;
		min-width: 0;
		height: 100%;
		padding: 0 8px;
		border-radius: 6px;
		border-width: 1px;
		border-style: solid;
		border-color: transparent;
		box-sizing: border-box;
		font-size: 12.5px;
		font-weight: 500;
		line-height: 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
		user-select: none;
		color: var(--ui-muted);
	}
	.tab:hover {
		color: var(--ui-ink);
	}
	.tab:active {
		opacity: 0.78;
	}
	.tab.active {
		color: var(--ui-ink);
	}
	.tab.active:active {
		opacity: 1;
	}
	.tab.fallback {
		background-color: var(--segment-thumb);
		border-color: var(--segment-thumb-border);
	}
	.tab:focus-visible {
		outline-width: 2px;
		outline-color: var(--ui-ink);
		outline-offset: -2px;
	}
	.tab.disabled {
		opacity: 0.4;
		cursor: default;
		pointer-events: none;
	}
</style>
