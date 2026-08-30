<script lang="ts">
	import { useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import type { PositionData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';

	let { id, data }: NodeProps<Node<PositionData>> = $props();

	const { updateNodeData } = useSvelteFlow();

	let pad = $state<HTMLDivElement>();
	let dragging = $state(false);

	const clampPct = (v: number) => Math.max(-50, Math.min(50, Math.round(v)));

	function setFromPointer(e: PointerEvent) {
		const el = pad;
		if (!el) return;
		const r = el.getBoundingClientRect();
		updateNodeData(id, {
			x: clampPct(((e.clientX - r.left) / r.width - 0.5) * 100),
			y: clampPct(((e.clientY - r.top) / r.height - 0.5) * 100),
			unit: 'percent'
		});
	}

	const onNum = (key: 'x' | 'y') => (e: Event) =>
		updateNodeData(id, { [key]: Number((e.currentTarget as HTMLInputElement).value) });
</script>

<div class="node transform-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Position</div>

	<div
		class="pad nodrag"
		bind:this={pad}
		role="presentation"
		onpointerdown={(e) => {
			dragging = true;
			e.currentTarget.setPointerCapture(e.pointerId);
			setFromPointer(e);
		}}
		onpointermove={(e) => {
			if (dragging) setFromPointer(e);
		}}
		onpointerup={() => (dragging = false)}
	>
		<div
			class="pad-dot"
			style:left="{50 + (data.unit === 'percent' ? Number(data.x) || 0 : 0)}%"
			style:top="{50 + (data.unit === 'percent' ? Number(data.y) || 0 : 0)}%"
		></div>
	</div>

	<label class="field">
		<span>X</span>
		<input class="nodrag" type="number" step="1" value={data.x} oninput={onNum('x')} />
	</label>

	<label class="field">
		<span>Y</span>
		<input class="nodrag" type="number" step="1" value={data.y} oninput={onNum('y')} />
	</label>

	<label class="field">
		<span>Unit</span>
		<select
			class="nodrag"
			value={data.unit}
			onchange={(e) =>
				updateNodeData(id, {
					unit: (e.currentTarget as HTMLSelectElement).value as PositionData['unit']
				})}
		>
			<option value="percent">% of stage</option>
			<option value="px">px</option>
		</select>
	</label>

	<div class="node-meta">
		{data.unit === 'percent' ? `${data.x}%, ${data.y}%` : `${data.x}px, ${data.y}px`}
	</div>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
