<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { TraceData } from '../flow/evaluate';
	import { markup } from '../flow/shapes';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<TraceData>> = $props();

	let pathCount = $derived((data.markup?.match(/<path/g) ?? []).length);
</script>

<div class="node source-node">
	<div class="node-title">Trace</div>

	<div class="thumb">
		{#if data.markup}
			<svg viewBox="0 0 120 120" width="72" height="72">
				<g use:markup={data.markup}></g>
			</svg>
		{:else}
			<div class="thumb-hint">upload an image in the inspector</div>
		{/if}
	</div>

	<div class="node-meta">
		{#if data.markup}
			{data.name} · {pathCount} paths
		{:else if data.name}
			{data.name} — press Trace in the inspector
		{:else}
			no image yet
		{/if}
	</div>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
