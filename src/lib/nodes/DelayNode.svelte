<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import type { DelayData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<DelayData>> = $props();

	const { updateNodeData } = useSvelteFlow();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Delay</div>

	<label class="field">
		<span>Duration ms</span>
		<input
			class="nodrag"
			type="number"
			min="50"
			step="100"
			value={data.duration}
			oninput={(e) =>
				updateNodeData(id, { duration: Number((e.currentTarget as HTMLInputElement).value) })}
		/>
	</label>

	<div class="node-meta">hold {data.duration}ms</div>

	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
