<script lang="ts">
	import { untrack } from 'svelte';
	import Portal from 'gpuix-svelte/components/Portal.svelte';
	import { Icon, dismiss_toast, toasts, type ToastItem } from 'gpuix-svelte-ui';
	import { holds_focus, test_id } from 'gpuix-svelte-ui/shared';
	import { toastMotion } from './motion.ts';
	import PillButton from './PillButton.svelte';

	type Shown = ToastItem & { leaving: boolean };

	let {
		position = 'bottom-right',
		testid = null
	}: {
		position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
		testid?: string | null;
	} = $props();

	let shown = $state<Shown[]>([]);
	let column: unknown = null;
	let seen = 0;
	let layer = 0;
	const fromTop = $derived(position.startsWith('top-'));

	const same = (a: Shown[], b: Shown[]) =>
		a.length === b.length &&
		a.every(
			(item, i) => item.id === b[i].id && item.leaving === b[i].leaving && item.title === b[i].title
		);

	$effect(() => {
		const live = toasts.current;
		const liveIds = new Set(live.map((item) => item.id));
		const prev = untrack(() => shown);
		const next: Shown[] = [];
		for (const item of prev) {
			if (liveIds.has(item.id)) {
				const fresh = live.find((toast) => toast.id === item.id);
				if (fresh) next.push({ ...fresh, leaving: false });
			} else {
				next.push(item.leaving ? item : { ...item, leaving: true });
			}
		}
		const have = new Set(next.map((item) => item.id));
		for (const item of live) {
			if (!have.has(item.id)) next.push({ ...item, leaving: false });
		}
		if (!same(prev, next)) shown = next;
	});

	function rest(id: number) {
		const item = shown.find((toast) => toast.id === id);
		if (!item?.leaving) return;
		shown = shown.filter((toast) => toast.id !== id);
	}

	function run(item: ToastItem) {
		item.action?.onclick();
		dismiss_toast(item.id);
	}

	// Portals paint in mount order. Remount when a toast arrives so it lands above a dialog opened since,
	// unless one of its buttons holds keyboard focus.
	function layerFor(latest: number) {
		if (latest !== seen && !holds_focus(column)) layer = latest;
		seen = latest;
		return layer;
	}
</script>

{#if shown.length > 0}
	{#key layerFor(toasts.latest)}
		<Portal>
			<div
				class="toaster {position}"
				{...test_id(testid)}
				{@attach (node: unknown) => {
					column = node;
				}}
			>
				{#each shown as item (item.id)}
					<div
						class="toast {item.tone}"
						class:leaving={item.leaving}
						role="status"
						motion={toastMotion(item.leaving, fromTop)}
						onmotioncomplete={() => rest(item.id)}
						{...test_id(testid ? `${testid}-${item.id}` : null)}
					>
						<div class="bar {item.tone}"></div>
						<div class="text">
							<div class="title">{item.title}</div>
							{#if item.description}<div class="description">{item.description}</div>{/if}
						</div>
						{#if item.action}
							<PillButton size="sm" variant="soft" onclick={() => run(item)}>
								{item.action.label}
							</PillButton>
						{/if}
						<PillButton
							size="sm"
							shape="circle"
							variant="ghost"
							label="Dismiss"
							onclick={() => dismiss_toast(item.id)}
							testid={testid ? `${testid}-${item.id}-close` : null}
						>
							<Icon name="close" size={14} />
						</PillButton>
					</div>
				{/each}
			</div>
		</Portal>
	{/key}
{/if}

<style>
	.toaster {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		pointer-events: none;
		user-select: none;
	}
	.toaster.top-left {
		top: 0;
		left: 0;
	}
	.toaster.top-center {
		top: 0;
		left: 0;
		right: 0;
		align-items: center;
	}
	.toaster.top-right {
		top: 0;
		right: 0;
		align-items: end;
	}
	.toaster.bottom-left {
		bottom: 0;
		left: 0;
	}
	.toaster.bottom-center {
		bottom: 0;
		left: 0;
		right: 0;
		align-items: center;
	}
	.toaster.bottom-right {
		bottom: 0;
		right: 0;
		align-items: end;
	}
	.toast {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		min-width: 260px;
		max-width: 420px;
		padding: 10px 10px 10px 0;
		border-radius: 10px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border-strong);
		overflow: hidden;
		pointer-events: auto;
		box-sizing: border-box;
		background-color: var(--ui-panel);
		color: var(--ui-ink);
	}
	.toast.leaving {
		pointer-events: none;
	}
	.bar {
		width: 4px;
		align-self: stretch;
		flex-shrink: 0;
		background-color: var(--ui-border-strong);
	}
	.bar.accent {
		background-color: var(--ui-accent);
	}
	.bar.success {
		background-color: var(--ui-success);
	}
	.bar.warning {
		background-color: var(--ui-warning);
	}
	.bar.danger {
		background-color: var(--ui-danger);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex-grow: 1;
		min-width: 0;
	}
	.title {
		font-size: 14px;
		font-weight: 500;
		line-height: 20px;
	}
	.description {
		font-size: 13px;
		line-height: 18px;
		color: var(--ui-muted);
	}
</style>
