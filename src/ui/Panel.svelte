<script lang="ts">
	import {
		Checkbox,
		RadioGroup,
		Slider,
		TextField
	} from 'gpuix-svelte-ui';
	import { targetExtname } from '../core/paths.ts';
	import { chooseOutputDir } from '../state/actions.ts';
	import { currentSpace, patchSpace } from '../state/spaces.svelte.ts';
	import PillButton from './PillButton.svelte';
	import ScrollArea from './ScrollArea.svelte';
	import SelectField from './SelectField.svelte';

	const space = $derived(currentSpace());
	const overwriteNote = $derived.by(() => {
		if (!space || !space.originalOutput || space.suffix !== '') return '';
		return space.format === 'original' ? 'Overwrites original files' : 'May overwrite matching files';
	});

	const formats = [
		{ value: 'original', label: 'Original' },
		{ value: 'avif', label: 'AVIF' },
		{ value: 'webp', label: 'WebP' },
		{ value: 'png', label: 'PNG' },
		{ value: 'jpg', label: 'JPG' }
	];

	const levelLabel = (level: number) => {
		if (level <= 3) return 'High';
		if (level <= 6) return 'Balanced';
		return 'Compact';
	};

	const numberOrBlank = (value: number | undefined) =>
		typeof value === 'number' ? String(value) : '';

	let widthDraft = $state('');
	let heightDraft = $state('');
	let widthError = $state<string | null>(null);
	let heightError = $state<string | null>(null);
	let lastSpaceId = '';

	$effect(() => {
		const id = space?.id ?? '';
		if (id !== lastSpaceId) {
			lastSpaceId = id;
			widthDraft = numberOrBlank(space?.width);
			heightDraft = numberOrBlank(space?.height);
			widthError = null;
			heightError = null;
		}
	});

	const handleSizeChange = (field: 'width' | 'height', value: string) => {
		const trimmed = value.trim();
		const isEmpty = trimmed === '';
		const isPositiveInt = /^[1-9]\d*$/.test(trimmed);
		const error = isEmpty || isPositiveInt ? null : 'Positive integer';

		if (field === 'width') {
			widthDraft = value;
			widthError = error;
			if (!error) patchSpace({ width: isEmpty ? undefined : Number(trimmed) });
		} else {
			heightDraft = value;
			heightError = error;
			if (!error) patchSpace({ height: isEmpty ? undefined : Number(trimmed) });
		}
	};
</script>

<div class="panel">
	<div class="heading">
		<div class="heading-title">Configuration</div>
	</div>

	{#if space}
		<ScrollArea gap={0} pad="0">
			<div class="section">
				<TextField
					label="Space name"
					value={space.name}
					onchange={(value) => patchSpace({ name: value })}
				/>
			</div>

			<div class="section">
				<div class="section-head">
					<div class="section-label">Resize</div>
					<div class="unit">px</div>
				</div>
				<div class="pair">
					<div class="grow">
						<TextField
							label="Width"
							placeholder="Auto"
							value={widthDraft}
							error={widthError}
							onchange={(value) => handleSizeChange('width', value)}
						/>
					</div>
					<div class="grow">
						<TextField
							label="Height"
							placeholder="Auto"
							value={heightDraft}
							error={heightError}
							onchange={(value) => handleSizeChange('height', value)}
						/>
					</div>
				</div>
			</div>

			<div class="section">
				<SelectField
					label="Format"
					testid="format-select"
					options={formats}
					value={space.format}
					onchange={(value) => patchSpace({ format: value as typeof space.format })}
				/>
				<Slider
					label="Level"
					min={1}
					max={9}
					step={1}
					value={space.level}
					format={(value) => `${value} · ${levelLabel(value)}`}
					onchange={(value) => patchSpace({ level: value })}
				/>
				<Checkbox
					label="Keep EXIF"
					checked={space.keepExif}
					onchange={(checked) => patchSpace({ keepExif: checked })}
				/>
			</div>

			<div class="section section-last">
				<div class="section-label">Save into</div>
				<RadioGroup
					value={space.originalOutput ? 'original' : 'custom'}
					onchange={(value) => {
						if (value === 'original') patchSpace({ originalOutput: true });
						else if (space.outputDir) patchSpace({ originalOutput: false });
						else chooseOutputDir();
					}}
					options={[
						{ value: 'original', label: 'Original folder' },
						{ value: 'custom', label: 'Custom folder' }
					]}
				/>
				{#if !space.originalOutput}
					<div class="dir-row">
						<div class="dir">{space.outputDir || 'No folder selected'}</div>
						<PillButton size="sm" variant="soft" onclick={chooseOutputDir}>
							{space.outputDir ? 'Change' : 'Choose'}
						</PillButton>
					</div>
				{/if}
				<TextField
					label="Filename suffix"
					value={space.suffix}
					onchange={(value) => patchSpace({ suffix: value })}
				/>
				<div class="preview">
					<div class="preview-label">Output</div>
					<div class="preview-path">
						<div class="muted">photo</div>
						<div class="suffix">{space.suffix}</div>
						<div class="muted">.{targetExtname('photo.jpg', space.format)}</div>
					</div>
				</div>
				{#if overwriteNote}
					<div class="overwrite-warn">{overwriteNote}</div>
				{/if}
			</div>
		</ScrollArea>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		width: 272px;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		border-right-width: 1px;
		border-right-style: solid;
		border-right-color: var(--ui-border);
		background-color: var(--surface-panel);
	}
	.heading {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 48px;
		flex-shrink: 0;
		padding: 0 14px;
		border-bottom-width: 1px;
		border-bottom-style: solid;
		border-bottom-color: var(--ui-border);
		background-color: var(--surface-panel);
	}
	.heading-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--ui-ink);
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 9px;
		padding: 12px 14px;
		border-bottom-width: 1px;
		border-bottom-style: solid;
		border-bottom-color: var(--ui-border);
	}
	.section-last {
		border-bottom-width: 0;
	}
	.section-head {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
	.section-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--ui-ink);
	}
	.unit {
		font-family: var(--ui-mono);
		font-size: 11px;
		color: var(--ui-muted);
	}
	.pair {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 8px;
	}
	.grow {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		width: 0;
	}
	.dir-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.dir {
		display: flex;
		align-items: center;
		flex-grow: 1;
		width: 0;
		height: 30px;
		padding: 0 10px;
		border-radius: 8px;
		font-size: 12px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		background-color: var(--ui-raised);
		color: var(--ui-ink);
	}
	.overwrite-warn {
		font-size: 11px;
		line-height: 15px;
		color: var(--ui-warning);
	}
	.preview {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.preview-label {
		flex-shrink: 0;
		font-size: 11px;
		color: var(--ui-muted);
	}
	.preview-path {
		display: flex;
		flex-direction: row;
		justify-content: end;
		min-width: 0;
		overflow: hidden;
		font-family: var(--ui-mono);
		font-size: 11px;
	}
	.muted {
		color: var(--ui-muted);
	}
	.suffix {
		font-weight: 600;
		color: var(--ui-ink);
	}
</style>
