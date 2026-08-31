<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { DelayData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<DelayData>> = $props();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Delay</div>
	<div class="node-meta">hold {data.duration}ms</div>
	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
