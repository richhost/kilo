<script lang="ts">
	import { focus_element, type ShadowNode } from 'gpuix-svelte';
	import Popover from 'gpuix-svelte/components/Popover.svelte';
	import { Icon } from 'gpuix-svelte-ui';
	import { chorded, key_of, repeats, type KeyLike } from 'gpuix-svelte-ui/keys';
	import { aria_disabled, own_hitbox, test_id, type Option } from 'gpuix-svelte-ui/shared';
	import { dropdownMotion } from './motion.ts';

	let {
		options,
		value,
		onchange,
		placeholder = 'Select…',
		label = null,
		disabled = false,
		testid = null
	}: {
		options: Option[];
		value: string | null;
		onchange: (value: string) => void;
		placeholder?: string;
		label?: string | null;
		disabled?: boolean;
		testid?: string | null;
	} = $props();

	let open = $state(false);
	let held = $state(false);
	let visible = $state(false);
	let active = $state(-1);
	let width = $state<number | null>(null);
	let triggerEl: ShadowNode | null = null;

	const selected = $derived(options.find((o) => o.value === value) ?? null);
	const popoverStyle = 'padding: 0; border-width: 0; background-color: transparent;';
	const listStyle = $derived(width === null ? 'min-width: 180px;' : `width: ${width}px;`);
	const listMotion = $derived(dropdownMotion(visible));

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

	function show() {
		if (disabled) return;
		const chosen = options.findIndex((o) => o.value === value && !o.disabled);
		active = chosen === -1 ? options.findIndex((o) => !o.disabled) : chosen;
		open = true;
	}

	function choose(option: Option) {
		if (!open || option.disabled) return;
		if (option.value !== value) onchange(option.value);
		open = false;
		focus_element(triggerEl);
	}

	function move(delta: number) {
		for (let step = 1; step <= options.length; step++) {
			const i = (active + delta * step + options.length * step) % options.length;
			if (!options[i].disabled) {
				active = i;
				return;
			}
		}
	}

	function keydown(e: KeyLike) {
		const key = key_of(e);
		if (chorded(e) && (open || (key !== 'down' && key !== 'up'))) return;
		const press = key === 'enter' || key === 'space';
		if (press && repeats(e)) {
			e.preventDefault();
			return;
		}
		if (!open) {
			if (press || key === 'down' || key === 'up') {
				e.preventDefault();
				show();
			}
			return;
		}
		if (key === 'down' || key === 'up') {
			e.preventDefault();
			move(key === 'down' ? 1 : -1);
		} else if (press) {
			e.preventDefault();
			if (options[active]) choose(options[active]);
		} else if (key === 'tab') {
			open = false;
		}
	}
</script>

<div
	class="select"
	class:disabled
	{...test_id(testid)}
	onlayout={(e) => {
		const next = Math.round(e.width ?? 0);
		if (next > 0 && next !== width) width = next;
	}}
>
	{#if label}<div class="label">{label}</div>{/if}
	<Popover
		open={held}
		onclose={() => (open = false)}
		style={popoverStyle}
		testid={testid ? `${testid}-list` : null}
	>
		<div
			class="trigger"
			class:open
			class:disabled
			style:width={width === null ? null : `${width}px`}
			role="button"
			aria-label={label}
			aria-expanded={open}
			tabindex={disabled ? -1 : 0}
			{...aria_disabled(disabled)}
			{...own_hitbox}
			{...test_id(testid ? `${testid}-trigger` : null)}
			{@attach (node: ShadowNode) => {
				triggerEl = node;
				return () => {
					triggerEl = null;
				};
			}}
			onclick={() => (open ? (open = false) : show())}
			onkeydown={keydown}
		>
			<div class="value" class:placeholder={selected === null}>{selected?.label ?? placeholder}</div>
			<Icon name="chevron-down" size={14} />
		</div>
		{#snippet content()}
			<div
				class="list"
				class:closing={!visible}
				style={listStyle}
				role="listbox"
				motion={listMotion}
				onmotioncomplete={rest}
			>
				{#each options as option, i (option.value)}
					<div
						class="option"
						class:active={i === active}
						class:disabled={option.disabled}
						role="option"
						aria-selected={option.value === value}
						{...aria_disabled(option.disabled)}
						{...own_hitbox}
						{...test_id(testid ? `${testid}-${option.value}` : null)}
						onclick={() => choose(option)}
						onmouseenter={() => {
							if (!option.disabled) active = i;
						}}
					>
						<div class="text">
							<div class="option-label">{option.label}</div>
							{#if option.description}<div class="description">{option.description}</div>{/if}
						</div>
						{#if option.value === value}<Icon name="check" size={12} />{/if}
					</div>
				{/each}
			</div>
		{/snippet}
	</Popover>
</div>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	.select.disabled {
		opacity: 0.5;
	}
	.trigger.disabled {
		pointer-events: none;
	}
	.label {
		font-size: 13px;
		font-weight: 500;
		line-height: 18px;
		color: var(--ui-ink);
	}
	.trigger {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 180px;
		height: 34px;
		padding: 0 10px;
		border-radius: 8px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border-strong);
		font-size: 14px;
		line-height: 20px;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		box-sizing: border-box;
		background-color: var(--ui-panel);
		color: var(--ui-ink);
	}
	.trigger:hover {
		border-color: var(--ui-muted);
	}
	.trigger:focus-visible {
		border-color: var(--ui-accent);
	}
	.trigger.open {
		border-color: var(--ui-accent);
	}
	.trigger.open:hover {
		border-color: var(--ui-accent);
	}
	.value.placeholder {
		color: var(--ui-muted);
	}
	.list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px;
		border-radius: 10px;
		border-width: 1px;
		border-style: solid;
		border-color: var(--ui-border-strong);
		box-sizing: border-box;
		background-color: var(--surface-selected);
	}
	.list.closing {
		pointer-events: none;
	}
	.option {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 8px;
		border-radius: 7px;
		font-size: 13px;
		line-height: 18px;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		color: var(--ui-ink);
	}
	.option.active {
		background-color: var(--ui-raised-hover);
	}
	.option:active {
		background-color: var(--ui-border-strong);
	}
	.option.disabled {
		opacity: 0.5;
	}
	.text {
		display: flex;
		flex-direction: column;
	}
	.description {
		font-size: 12px;
		line-height: 16px;
		color: var(--ui-muted);
	}
</style>
