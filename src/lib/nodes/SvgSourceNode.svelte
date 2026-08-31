<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { SvgSourceData } from '../flow/evaluate';
	import { markup, markupFor } from '../flow/shapes';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<SvgSourceData>> = $props();

	let previewMarkup = $derived(markupFor(data));
	let size = $derived(Math.max(8, Number(data.size) || 120));
</script>

<div class="node source-node">
	<div class="node-title">SVG Source</div>

	<div class="thumb">
		<svg viewBox="0 0 {size} {size}" width="72" height="72">
			<g use:markup={previewMarkup}></g>
		</svg>
	</div>

	<div class="node-meta">{data.shape} · {size}px</div>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
