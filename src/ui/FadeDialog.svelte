<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dismiss_layer, dismiss_scope } from 'gpuix-svelte';
	import Portal from 'gpuix-svelte/components/Portal.svelte';
	import { Icon } from 'gpuix-svelte-ui';
	import { test_id } from 'gpuix-svelte-ui/shared';
	import { dialogMotion } from './motion.ts';
	import PillButton from './PillButton.svelte';

	let {
		open,
		onclose,
		title = null,
		children,
		actions = null,
		testid = null
	}: {
		open: boolean;
		onclose: () => void;
		title?: string | null;
		children: Snippet;
		actions?: Snippet | null;
		testid?: string | null;
	} = $props();

	let mounted = $state(false);
	let visible = $state(false);

	const scope = dismiss_scope();
	const motion = $derived(dialogMotion(visible));

	$effect(() => {
		if (open) {
			mounted = true;
			visible = true;
			return;
		}
		visible = false;
	});

	$effect(() => {
		if (!mounted) return;
		return dismiss_layer({ onEscape: () => onclose(), scope });
	});

	function rest() {
		if (visible) return;
		mounted = false;
	}

	type Targeted = { target?: unknown; currentTarget?: unknown };
	let pressedScrim = false;
	const onScrim = (e: Targeted) => e.target === e.currentTarget;
	function scrimClick(e: Targeted) {
		if (pressedScrim && onScrim(e)) onclose();
		pressedScrim = false;
	}
</script>

{#if mounted}
	<Portal>
		<div
			class="scrim"
			class:closing={!visible}
			{motion}
			onmotioncomplete={rest}
			onmousedown={(e) => (pressedScrim = onScrim(e))}
			onclick={scrimClick}
			{...test_id(testid ? `${testid}-scrim` : null)}
		>
			<div
				class="dialog"
				role="dialog"
				aria-label={title}
				onclick={(e) => e.stopPropagation()}
				{...test_id(testid)}
			>
				{#if title}
					<div class="head">
						<div class="title">{title}</div>
						<PillButton
							variant="ghost"
							shape="circle"
							size="sm"
							label="Close"
							onclick={onclose}
							testid={testid ? `${testid}-close` : null}
						>
							<Icon name="close" size={14} />
						</PillButton>
					</div>
				{/if}
				<div class="body">{@render children()}</div>
				{#if actions}<div class="actions">{@render actions()}</div>{/if}
			</div>
		</div>
	</Portal>
{/if}

<style>
	.scrim {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 24px;
		box-sizing: border-box;
		background-color: #00000099;
		user-select: none;
	}
	.scrim.closing {
		pointer-events: none;
	}
	.dialog {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		max-width: 440px;
		padding: 20px;
		border-radius: 12px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border-strong);
		box-sizing: border-box;
		background-color: var(--ui-panel);
		color: var(--ui-ink);
	}
	.head {
		display: flex;
		flex-direction: row;
		align-items: start;
		justify-content: space-between;
		gap: 12px;
	}
	.title {
		font-size: 16px;
		font-weight: 600;
		line-height: 22px;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 14px;
	}
	.actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: end;
		gap: 8px;
	}
</style>
