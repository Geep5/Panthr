<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { ColorData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<ColorData>> = $props();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Color</div>
	<div class="node-meta">
		<span class="color-swatch" style:background={data.color}></span>
		{data.color}
	</div>
	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
