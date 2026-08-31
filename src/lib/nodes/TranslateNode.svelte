<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { TranslateData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<TranslateData>> = $props();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Move X</div>
	<div class="node-meta">
		{data.amount >= 0 ? 'right' : 'left'}
		{Math.abs(data.amount)}{data.unit === 'px' ? 'px' : '%'} over {data.duration}ms
	</div>
	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
