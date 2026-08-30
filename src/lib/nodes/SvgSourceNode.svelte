<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import DynamicHandles from './DynamicHandles.svelte';
	import type { SvgSourceData } from '../flow/evaluate';
	import { markup, markupFor } from '../flow/shapes';

	let { id, data }: NodeProps<Node<SvgSourceData>> = $props();

	const { updateNodeData } = useSvelteFlow();

	const shapes = ['rect', 'circle', 'triangle', 'star', 'heart', 'custom'] as const;

	let previewMarkup = $derived(markupFor(data));
	let size = $derived(Math.max(8, Number(data.size) || 120));

	const onNum =
		(key: 'size') =>
		(e: Event) =>
			updateNodeData(id, { [key]: Number((e.currentTarget as HTMLInputElement).value) });
</script>

<div class="node source-node">
	<div class="node-title">SVG Source</div>

	<div class="thumb">
		<svg viewBox="0 0 {size} {size}" width="72" height="72">
			<g use:markup={previewMarkup}></g>
		</svg>
	</div>

	<label class="field">
		<span>Shape</span>
		<select
			class="nodrag"
			value={data.shape}
			onchange={(e) =>
				updateNodeData(id, {
					shape: (e.currentTarget as HTMLSelectElement).value as SvgSourceData['shape']
				})}
		>
			{#each shapes as s (s)}
				<option value={s}>{s}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>Size</span>
		<input class="nodrag" type="number" min="8" step="4" value={data.size} oninput={onNum('size')} />
	</label>

	<label class="field">
		<span>Fill</span>
		<input
			class="nodrag"
			type="color"
			value={data.fill}
			oninput={(e) => updateNodeData(id, { fill: (e.currentTarget as HTMLInputElement).value })}
		/>
	</label>

	{#if data.shape === 'custom'}
		<textarea
			class="nodrag nowheel custom-markup"
			rows="4"
			spellcheck="false"
			placeholder="<path d=&quot;...&quot; fill=&quot;#fff&quot;/>"
			value={data.customMarkup}
			oninput={(e) =>
				updateNodeData(id, { customMarkup: (e.currentTarget as HTMLTextAreaElement).value })}
		></textarea>
	{/if}

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
