<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import type { TextData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<TextData>> = $props();

	const { updateNodeData } = useSvelteFlow();
</script>

<div class="node text-node">
	<div class="node-title">Text</div>

	<div
		class="thumb text-thumb"
		style:color={data.fill}
		style:font-size="{Math.max(10, Math.min(26, Number(data.fontSize) || 36))}px"
	>
		{data.text || 'Text'}
	</div>

	<label class="field">
		<span>Text</span>
		<input
			class="nodrag text-input"
			type="text"
			value={data.text}
			oninput={(e) => updateNodeData(id, { text: (e.currentTarget as HTMLInputElement).value })}
		/>
	</label>

	<label class="field">
		<span>Size</span>
		<input
			class="nodrag"
			type="number"
			min="8"
			step="2"
			value={data.fontSize}
			oninput={(e) =>
				updateNodeData(id, { fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
		/>
	</label>

	<label class="field">
		<span>Fill</span>
		<input
			class="nodrag"
			type="color"
			value={data.fill}
			oninput={(e) => updateNodeData(id, { fill: (e.currentTarget as HTMLInputElement).value })}
		/>
	</label>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
