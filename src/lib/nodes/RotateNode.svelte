<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { RotateData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<RotateData>> = $props();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Rotate</div>
	<div class="node-meta">
		{data.degrees >= 0 ? 'clockwise' : 'counter-clockwise'}
		{Math.abs(data.degrees)}° over {data.duration}ms
	</div>
	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
