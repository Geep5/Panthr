<script lang="ts">
	import {
		BaseEdge,
		EdgeReconnectAnchor,
		getBezierPath,
		type EdgeProps
	} from '@xyflow/svelte';

	let {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		markerEnd,
		style
	}: EdgeProps = $props();

	let [path] = $derived(
		getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
	);

	// sit on the edge just clear of the handles, so the handles stay clickable
	const OFFSET = 18;
	let dir = $derived(targetX >= sourceX ? 1 : -1);
	let sourceAnchor = $derived({ x: sourceX + OFFSET * dir, y: sourceY });
	let targetAnchor = $derived({ x: targetX - OFFSET * dir, y: targetY });
</script>

<BaseEdge {id} {path} {markerEnd} {style} />
<EdgeReconnectAnchor type="source" position={sourceAnchor} size={16}>
	<div class="reconnect-dot"></div>
</EdgeReconnectAnchor>
<EdgeReconnectAnchor type="target" position={targetAnchor} size={16}>
	<div class="reconnect-dot"></div>
</EdgeReconnectAnchor>
