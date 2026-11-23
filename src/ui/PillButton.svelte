<script lang="ts">
	import type { Snippet } from 'svelte';
	import { activates } from 'gpuix-svelte-ui/keys';
	import { aria_disabled, own_hitbox, test_id } from 'gpuix-svelte-ui/shared';

	let {
		children,
		variant = 'soft',
		shape = 'pill',
		size = 'sm',
		disabled = false,
		label = null,
		onclick,
		onmouseenter,
		onmouseleave,
		onfocus,
		onblur,
		testid = null
	}: {
		children?: Snippet;
		variant?: 'soft' | 'ghost' | 'ink' | 'danger';
		shape?: 'pill' | 'circle';
		size?: 'sm' | 'md';
		disabled?: boolean;
		label?: string | null;
		onclick?: () => void;
		onmouseenter?: () => void;
		onmouseleave?: () => void;
		onfocus?: () => void;
		onblur?: () => void;
		testid?: string | null;
	} = $props();

	function press() {
		if (!disabled) onclick?.();
	}
</script>

<div
	class="pill {variant} {shape} {size}"
	class:disabled
	role="button"
	aria-label={label}
	tabindex={disabled ? -1 : 0}
	{...aria_disabled(disabled)}
	{...own_hitbox}
	{...test_id(testid)}
	onclick={press}
	onkeydown={(e) => activates(e) && press()}
	{onmouseenter}
	{onmouseleave}
	{onfocus}
	{onblur}
>
	{@render children?.()}
</div>

<style>
	.pill {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: 999px;
		border-width: 1px;
		border-style: solid;
		border-color: transparent;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		box-sizing: border-box;
	}
	.pill.sm {
		height: 30px;
		padding: 0 12px;
		gap: 6px;
		font-size: 12.5px;
	}
	.pill.md {
		height: 34px;
		padding: 0 16px;
		gap: 7px;
		font-size: 13px;
	}
	.pill.circle.sm {
		width: 28px;
		height: 28px;
		padding: 0;
		gap: 0;
	}
	.pill.circle.md {
		width: 32px;
		height: 32px;
		padding: 0;
		gap: 0;
	}
	.pill.soft {
		background-color: var(--ui-raised);
		color: var(--ui-ink);
	}
	.pill.soft:hover {
		background-color: var(--ui-raised-hover);
	}
	.pill.ghost {
		background-color: transparent;
		color: var(--ui-muted);
	}
	.pill.ghost:hover {
		background-color: var(--ui-raised);
		color: var(--ui-ink);
	}
	.pill.ink {
		background-color: var(--ui-ink);
		color: var(--ui-bg);
	}
	.pill.ink:hover {
		opacity: 0.88;
	}
	.pill.danger {
		background-color: var(--ui-danger-wash);
		color: var(--ui-danger);
	}
	.pill.danger:hover {
		border-color: var(--ui-danger);
	}
	.pill.soft:active {
		background-color: var(--ui-border-strong);
	}
	.pill.ghost:active {
		background-color: var(--ui-raised-hover);
		color: var(--ui-ink);
	}
	.pill.ink:active {
		opacity: 0.8;
	}
	.pill.danger:active {
		opacity: 0.8;
	}
	.pill:focus-visible {
		outline-width: 2px;
		outline-color: var(--ui-ink);
		outline-offset: 2px;
	}
	.pill.disabled {
		opacity: 0.4;
		cursor: default;
		pointer-events: none;
	}
</style>
