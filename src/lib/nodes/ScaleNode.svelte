<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { ScaleData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<ScaleData>> = $props();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Scale</div>
	<div class="node-meta">{data.percent >= 0 ? '+' : ''}{data.percent}% over {data.duration}ms</div>
	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
