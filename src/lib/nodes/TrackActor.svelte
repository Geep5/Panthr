<script lang="ts">
	import { getContext } from 'svelte';
	import { buildAnimation, resolveOffsets, type Track } from '../flow/evaluate';
	import { markup } from '../flow/shapes';

	let { track, k }: { track: Track; k: number } = $props();

	// the preview keeps a registry of its actors' animations: getAnimations()
	// drops finished ones, which would dead-end the scrubber
	const registry = getContext<Map<number, Animation>>('panthr-anim-registry');

	let actor = $state<HTMLDivElement>();

	$effect(() => {
		const el = actor;
		if (!el) return;
		const t = track;
		el.getAnimations().forEach((a) => a.cancel());
		const stage = el.closest('.stage');
		const w = stage?.clientWidth ?? 260;
		const h = stage?.clientHeight ?? 180;
		const anim = buildAnimation(t, w, h);
		if (anim) {
			el.style.transform = '';
			// created paused: the preview node's transport drives playback
			const wa = el.animate(anim.keyframes, anim.options);
			wa.pause();
			registry.set(k, wa);
			return () => {
				wa.cancel();
				registry.delete(k);
			};
		} else {
			registry.delete(k);
			const b = resolveOffsets(t.offsets, w, h);
			el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px)`;
		}
	});
</script>

{#if track.kind === 'text'}
	<div class="actor text-actor" bind:this={actor}>
		<span class="text-glyph" style:font-size="{track.size}px" style:color={track.fill}>
			{track.text}
		</span>
	</div>
{:else}
	<div class="actor" bind:this={actor} style:width="{track.size}px" style:height="{track.size}px">
		<svg viewBox="0 0 {track.size} {track.size}" width="100%" height="100%">
			<g use:markup={track.markup}></g>
		</svg>
	</div>
{/if}
