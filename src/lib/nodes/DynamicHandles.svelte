<script lang="ts">
	import {
		Handle,
		Position,
		useEdges,
		useStore,
		useUpdateNodeInternals,
		type Connection,
		type Edge
	} from '@xyflow/svelte';

	let {
		nodeId,
		type,
		mirrorInputs = false,
		fixed = 0
	}: { nodeId: string; type: 'source' | 'target'; mirrorInputs?: boolean; fixed?: number } = $props();

	const edges = useEdges();
	const store = useStore();
	const updateNodeInternals = useUpdateNodeInternals();

	let incoming = $derived(edges.current.filter((e) => e.target === nodeId));
	let outgoing = $derived(edges.current.filter((e) => e.source === nodeId));

	// target side: one wire per handle, always a free spare below.
	// source side: a fixed count (single shape = single output), mirrored
	// handles corresponding to occupied inputs (in-i feeds out-i), or a free
	// spare for fan-out.
	let count = $derived(
		fixed > 0
			? fixed
			: type === 'target'
				? incoming.length + 1
				: mirrorInputs
					? Math.max(incoming.length, outgoing.length)
					: outgoing.length + 1
	);
	let occupied = $derived(type === 'target' ? incoming.length : outgoing.length);
	let position = $derived(type === 'target' ? Position.Left : Position.Right);

	// xyflow only measures handle bounds on internals updates; without this,
	// handles added after mount can't start or receive connections
	let measured: number | null = null;
	$effect(() => {
		if (measured === count) return;
		const first = measured === null;
		measured = count;
		if (!first) updateNodeInternals(nodeId);
	});

	/**
	 * Handles reject no-op connections themselves. During a drag only the
	 * start handle's validator runs, so both sides check the candidate's
	 * target handle against the live edge list.
	 */
	function accepts(index: number) {
		return (conn: Edge | Connection): boolean => {
			const global = store.isValidConnection?.(conn) ?? true;
			if (!conn.source || !conn.target) return global;
			if (conn.source === conn.target) return false; // self-loop
			const handleId =
				type === 'target'
					? index === 0
						? null
						: `target-${index}`
					: (conn.targetHandle ?? null);
			const atTarget = edges.current.filter((e) => e.target === conn.target);
			if (atTarget.some((e) => (e.targetHandle ?? null) === handleId)) return false; // occupied
			// same wire = same track = no change. Different source handles on the
			// same node carry different tracks, so those are allowed.
			const sameWire = atTarget.some(
				(e) => e.source === conn.source && (e.sourceHandle ?? null) === (conn.sourceHandle ?? null)
			);
			if (sameWire) return false;
			return global;
		};
	}
</script>

{#each { length: count } as _, i (i)}
	<Handle
		{type}
		id={i === 0 ? undefined : `${type}-${i}`}
		{position}
		style="top: {30 + i * 20}px;"
		class={i >= occupied ? 'free' : 'connected'}
		isValidConnection={accepts(i)}
	/>
{/each}
