<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { AiData } from '../flow/evaluate';
	import { markup } from '../flow/shapes';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<AiData>> = $props();

	let size = $derived(Math.max(8, Number(data.size) || 120));
</script>

<div class="node source-node">
	<div class="node-title">AI SVG</div>

	<div class="thumb">
		{#if data.markup}
			<svg viewBox="0 0 {size} {size}" width="72" height="72">
				<g use:markup={data.markup}></g>
			</svg>
		{:else}
			<div class="thumb-hint">no image yet</div>
		{/if}
	</div>

	<div class="node-meta">
		{#if data.status === 'loading'}
			generating…
		{:else if data.status === 'error'}
			error — see inspector
		{:else if data.prompt}
			"{data.prompt}"
		{:else}
			describe it in the inspector
		{/if}
	</div>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
