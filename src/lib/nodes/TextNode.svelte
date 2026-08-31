<script lang="ts">
	import type { Node, NodeProps } from '@xyflow/svelte';
	import type { TextData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<TextData>> = $props();
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

	<div class="node-meta">{data.fontSize}px</div>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
