<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import DynamicHandles from './DynamicHandles.svelte';
	import type { TranslateData } from '../flow/evaluate';

	let { id, data }: NodeProps<Node<TranslateData>> = $props();

	const { updateNodeData } = useSvelteFlow();
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Move X</div>

	<label class="field">
		<span>Amount</span>
		<input
			class="nodrag"
			type="number"
			step="1"
			value={data.amount}
			oninput={(e) => updateNodeData(id, { amount: Number((e.currentTarget as HTMLInputElement).value) })}
		/>
	</label>

	<label class="field">
		<span>Unit</span>
		<select
			class="nodrag"
			value={data.unit}
			onchange={(e) =>
				updateNodeData(id, {
					unit: (e.currentTarget as HTMLSelectElement).value as TranslateData['unit']
				})}
		>
			<option value="px">px</option>
			<option value="percent">% of screen</option>
		</select>
	</label>

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

	<div class="node-meta">
		{data.amount >= 0 ? 'right' : 'left'} {Math.abs(data.amount)}{data.unit === 'px' ? 'px' : '%'}
	</div>

	<DynamicHandles nodeId={id} type="source" mirrorInputs />
</div>
