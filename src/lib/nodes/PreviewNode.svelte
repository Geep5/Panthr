<script lang="ts">
	import { onDestroy } from 'svelte';
	import lottie, { type AnimationItem } from 'lottie-web';
	import {
		useEdges,
		useNodes,
		useSvelteFlow,
		type Node,
		type NodeProps
	} from '@xyflow/svelte';
	import { evaluateGraph, type PreviewData } from '../flow/evaluate';
	import { buildLottie } from '../flow/lottie';
	import DynamicHandles from './DynamicHandles.svelte';

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

	// --- lottie playback: the preview plays the actual compiled Lottie ---

	let stageEl = $state<HTMLDivElement>();
	let anim: AnimationItem | null = null;
	let playing = $state(false);
	let progress = $state(0);
	let scrubbing = false;
	let lastJson = '';

	$effect(() => {
		const el = stageEl;
		if (!el) return;
		// node drags retrigger evaluation; only rebuild when tracks changed
		const json = JSON.stringify(visible);
		if (json === lastJson && anim) return;
		lastJson = json;
		anim?.destroy();
		anim = null;
		playing = false;
		progress = 0;
		if (visible.length === 0) return;
		const { animationData } = buildLottie(visible, el.offsetWidth || 260, el.offsetHeight || 180);
		anim = lottie.loadAnimation({
			container: el,
			renderer: 'svg',
			loop: false,
			autoplay: false,
			animationData
		});
		anim.addEventListener('complete', () => {
			playing = false;
			progress = 100;
		});
	});

	onDestroy(() => anim?.destroy());

	function togglePlay() {
		if (!anim) return;
		if (playing) {
			anim.pause();
			playing = false;
		} else {
			if (progress >= 100) anim.goToAndStop(0, true);
			anim.play();
			playing = true;
		}
	}

	function scrubTo(pct: number) {
		if (!anim) return;
		progress = pct;
		playing = false;
		anim.goToAndStop((pct / 100) * anim.totalFrames, true);
	}

	$effect(() => {
		let raf = 0;
		const tick = () => {
			if (anim && playing && !scrubbing) {
				progress = Math.min(100, (anim.currentFrame / Math.max(1, anim.totalFrames)) * 100);
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	function exportLottie() {
		const el = stageEl;
		if (visible.length === 0) return;
		const { animationData } = buildLottie(visible, el?.offsetWidth || 260, el?.offsetHeight || 180);
		const blob = new Blob([JSON.stringify(animationData)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'panthr-animation.json';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="node preview-node">
	<DynamicHandles nodeId={id} type="target" />
	<div class="node-title">Preview</div>

	<div class="stage" bind:this={stageEl}>
		{#if visible.length === 0}
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
		<button
			class="play-btn nodrag"
			title="Export Lottie JSON"
			disabled={visible.length === 0}
			onclick={exportLottie}
		>
			⭳
		</button>
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
