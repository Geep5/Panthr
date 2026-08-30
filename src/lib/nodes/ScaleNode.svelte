<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import DynamicHandles from './DynamicHandles.svelte';
	import type { ScaleData } from '../flow/evaluate';

	let { id, data }: NodeProps<Node<ScaleData>> = $props();

	const { updateNodeData } = useSvelteFlow();

	const onNum = (key: 'percent' | 'duration') => (e: Event) =>
		updateNodeData(id, { [key]: Number((e.currentTarget as HTMLInputElement).value) });
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Scale</div>

	<label class="field">
		<span>Grow %</span>
		<input class="nodrag" type="number" step="1" value={data.percent} oninput={onNum('percent')} />
	</label>

	<label class="field">
		<span>Duration ms</span>
		<input
			class="nodrag"
			type="number"
			min="50"
			step="100"
			value={data.duration}
			oninput={onNum('duration')}
		/>
	</label>

	<div class="node-meta">{data.percent >= 0 ? '+' : ''}{data.percent}% over {data.duration}ms</div>

	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
