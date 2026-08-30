<script lang="ts">
	import { setContext } from 'svelte';
	import {
		useEdges,
		useNodes,
		useSvelteFlow,
		type Node,
		type NodeProps
	} from '@xyflow/svelte';
	import { evaluateGraph, type PreviewData } from '../flow/evaluate';
	import DynamicHandles from './DynamicHandles.svelte';
	import TrackActor from './TrackActor.svelte';

	let { id, data }: NodeProps<Node<PreviewData>> = $props();

	const nodes = useNodes();
	const edges = useEdges();
	const { updateNodeData } = useSvelteFlow();

	let evaluated = $derived(evaluateGraph(id, nodes.current, edges.current));
	let hasAnim = $derived(evaluated.tracks.some((t) => t.steps.length > 0));
	let filter = $derived(data.filter ?? 'all');
	let visible = $derived(
		filter === 'all' ? evaluated.tracks : evaluated.tracks.filter((t) => t.sourceId === filter)
	);
	// one entry per source even when the same shape arrives on several wires
	let sourceIds = $derived([...new Set(evaluated.tracks.map((t) => t.sourceId))]);

	// --- transport: play/pause + 0-100% scrub across all actor animations ---

	let playing = $state(false);
	let progress = $state(0);
	let scrubbing = false;

	const animRegistry = new Map<number, Animation>();
	setContext('panthr-anim-registry', animRegistry);

	const anims = (): Animation[] => [...animRegistry.values()];

	function togglePlay() {
		const all = anims();
		if (all.length === 0) return;
		if (playing) {
			all.forEach((a) => a.pause());
			playing = false;
		} else {
			all.forEach((a) => {
				if (a.playState === 'finished') a.currentTime = 0;
				a.play();
			});
			playing = true;
		}
	}

	function scrubTo(pct: number) {
		progress = pct;
		playing = false;
		anims().forEach((a) => {
			a.pause();
			const d = Number(a.effect?.getTiming().duration) || 0;
			a.currentTime = (pct / 100) * d;
		});
	}

	$effect(() => {
		let raf = 0;
		const tick = () => {
			const all = anims();
			if (playing && all.length > 0) {
				// animations recreated by graph edits start paused; pick them up
				all.forEach((a) => {
					if (a.playState === 'paused') a.play();
				});
				// the timeline is as long as the longest track; drive the
				// scrubber from it so shorter tracks finishing early don't
				// pin progress at 100%
				const durations = all.map((a) => Number(a.effect?.getTiming().duration) || 0);
				const lead = all[durations.indexOf(Math.max(...durations))];
				if (!scrubbing) {
					const total = Number(lead.effect?.getTiming().duration) || 1;
					progress = Math.min(100, (Number(lead.currentTime) / total) * 100);
				}
				if (lead.playState === 'finished') {
					playing = false;
					progress = 100;
				}
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="node preview-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Preview</div>

	<div class="stage">
		{#if visible.length > 0}
			{#each visible as track, i (i)}
				<TrackActor {track} k={i} />
			{/each}
		{:else}
			<div class="stage-hint">{evaluated.error ?? 'Nothing to show for this filter'}</div>
		{/if}
	</div>

	<div class="transport nodrag">
		<button class="play-btn nodrag" disabled={!hasAnim} onclick={togglePlay}>
			{playing ? '❚❚' : '▶'}
		</button>
		<input
			class="scrub nodrag nowheel"
			type="range"
			min="0"
			max="100"
			step="0.1"
			value={progress}
			disabled={!hasAnim}
			oninput={(e) => {
				scrubbing = true;
				scrubTo(Number((e.currentTarget as HTMLInputElement).value));
			}}
			onchange={() => (scrubbing = false)}
		/>
		<span class="pct">{Math.round(progress)}%</span>
	</div>

	{#if evaluated.tracks.length > 1}
		<label class="field">
			<span>Show</span>
			<select
				class="nodrag"
				value={filter}
				onchange={(e) => updateNodeData(id, { filter: (e.currentTarget as HTMLSelectElement).value })}
			>
				<option value="all">all shapes</option>
				{#each sourceIds as sid (sid)}
					<option value={sid}>{sid}</option>
				{/each}
			</select>
		</label>
	{/if}

	<div class="node-meta">
		{evaluated.tracks.length} shape{evaluated.tracks.length === 1 ? '' : 's'}
		{#if evaluated.error}· {evaluated.error}{/if}
	</div>

	<DynamicHandles nodeId={id} type="source" fixed={1} />
</div>
