<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import type { RotateData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<RotateData>> = $props();

	const { updateNodeData } = useSvelteFlow();

	const onNum = (key: 'degrees' | 'duration') => (e: Event) =>
		updateNodeData(id, { [key]: Number((e.currentTarget as HTMLInputElement).value) });
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Rotate</div>

	<label class="field">
		<span>Degrees</span>
		<input class="nodrag" type="number" step="15" value={data.degrees} oninput={onNum('degrees')} />
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

	<div class="node-meta">
		{data.degrees >= 0 ? 'clockwise' : 'counter-clockwise'} {Math.abs(data.degrees)}° over {data.duration}ms
	</div>

	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
