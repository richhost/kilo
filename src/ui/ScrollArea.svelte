<script lang="ts">
	import type { Snippet } from 'svelte';
	import { get_native, type GpuixEvent, type Native, type ShadowNode } from 'gpuix-svelte';

	const {
		children,
		gap = 8,
		pad = '0'
	}: {
		children: Snippet;
		gap?: number;
		pad?: string;
	} = $props();

	let column: ShadowNode | null = null;
	let thumb = $state({ top: 0, height: 0 });
	let drag = $state<{ y: number; offset: number } | null>(null);
	let column_height = 0;
	let content_height = 0;
	let scroll_y = 0;

	type Metrics = { native: Native; viewport: number; total: number; offset: number };

	function metrics(): Metrics | null {
		const native = get_native();
		if (!native || !column?.nativeId || column_height <= 0 || content_height <= 0) return null;
		return { native, viewport: column_height, total: content_height, offset: scroll_y };
	}

	function place(m: Metrics, offset: number) {
		let top = 0;
		let height = 0;
		if (m.total > m.viewport) {
			const h = Math.min(m.viewport, Math.max(24, (m.viewport / m.total) * m.viewport));
			height = Math.round(h);
			const maxTop = Math.max(0, m.viewport - height);
			top = Math.max(
				0,
				Math.min(maxTop, Math.round((-offset / (m.total - m.viewport)) * (m.viewport - h)))
			);
		}
		if (top !== thumb.top || height !== thumb.height) {
			thumb = { top, height };
		}
	}

	function update() {
		const m = metrics();
		if (!m) return;
		place(m, m.offset);
	}

	function grab(e: GpuixEvent) {
		if (e.button !== 0 || e.y === undefined) return;
		const m = metrics();
		if (m) drag = { y: e.y, offset: m.offset };
	}

	function release() {
		drag = null;
	}

	function drag_to(e: GpuixEvent) {
		if (drag === null) return;
		if (e.pressedButton == null || e.y === undefined) {
			release();
			return;
		}
		const m = metrics();
		if (!m || m.total <= m.viewport) return;

		const travel = m.viewport - thumb.height;
		if (travel <= 0) return;
		const wanted = drag.offset - ((e.y - drag.y) / travel) * (m.total - m.viewport);
		const offset = Math.max(m.viewport - m.total, Math.min(0, wanted));
		scroll_y = offset;
		m.native.scrollTo(column!.nativeId!, 0, offset);
		place(m, offset);
	}

	function on_column_layout(e: GpuixEvent) {
		column_height = e.height ?? 0;
		update();
	}

	function on_content_layout(e: GpuixEvent) {
		content_height = e.height ?? 0;
		update();
	}

	function on_scroll_change(e: GpuixEvent) {
		scroll_y = e.scrollY ?? 0;
		update();
	}
</script>

<div class="wrap">
	<div
		{@attach (node: ShadowNode) => (column = node)}
		onlayout={on_column_layout}
		onscrollchange={on_scroll_change}
		class="column"
	>
		<div onlayout={on_content_layout} class="content" style="gap: {gap}px; padding: {pad}">
			{@render children()}
		</div>
	</div>

	<div class="gutter">
		<div
			class="thumb"
			class:dragging={drag !== null}
			style:top="{thumb.top}px"
			style:height="{thumb.height}px"
			onmousedown={grab}
			onmousemove={drag_to}
			onmouseup={release}
		></div>
	</div>
</div>

<style>
	.wrap {
		position: relative;
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		flex-basis: 0;
		min-height: 0;
		min-width: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.column {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		flex-basis: 0;
		min-height: 0;
		height: 100%;
		overflow-y: scroll;
	}
	.content {
		display: flex;
		flex-direction: column;
	}
	.gutter {
		position: absolute;
		top: 0;
		right: 2px;
		bottom: 0;
		width: 5px;
		pointer-events: none;
	}
	.thumb {
		position: absolute;
		left: 0;
		width: 5px;
		border-radius: 999px;
		cursor: default;
		user-select: none;
		pointer-events: auto;
		background-color: var(--scroller-thumb, #404040);
	}
	.thumb:hover {
		background-color: var(--scroller-thumb-hover, #5a5a5a);
	}
	.thumb.dragging {
		background-color: var(--scroller-thumb-hover, #5a5a5a);
	}
</style>
