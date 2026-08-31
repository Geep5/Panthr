<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { PositionData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<PositionData>> = $props();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Position</div>
	<div class="node-meta">
		{data.unit === 'percent' ? `${data.x}%, ${data.y}%` : `${data.x}px, ${data.y}px`}
	</div>
	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
