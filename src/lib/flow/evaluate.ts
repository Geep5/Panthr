import type { Edge, Node } from '@xyflow/svelte';
import { markupFor } from './shapes';

export interface SvgSourceData extends Record<string, unknown> {
	shape: 'rect' | 'circle' | 'triangle' | 'star' | 'heart' | 'custom';
	size: number;
	fill: string;
	customMarkup: string;
}

export interface ScaleData extends Record<string, unknown> {
	percent: number;
	duration: number;
}

export interface TranslateData extends Record<string, unknown> {
	amount: number;
	unit: 'px' | 'percent';
	duration: number;
}

export interface TextData extends Record<string, unknown> {
	text: string;
	fontSize: number;
	fill: string;
}

export interface DelayData extends Record<string, unknown> {
	duration: number;
}

export interface RotateData extends Record<string, unknown> {
	degrees: number;
	duration: number;
}

export interface PositionData extends Record<string, unknown> {
	x: number;
	y: number;
	unit: 'px' | 'percent';
}

export interface PreviewData extends Record<string, unknown> {
	/** 'all' or a source node id to isolate one shape. */
	filter: string;
}

export interface AnimStep {
	/** wait: hold the current transform for `duration`. */
	kind: 'scale' | 'translateX' | 'rotate' | 'wait';
	/** scale: % delta (+10 = grow 10%). translateX: amount in `unit`. rotate: degrees. */
	amount: number;
	unit: 'px' | 'percent';
	duration: number;
}

export interface PosOffset {
	x: number;
	y: number;
	unit: 'px' | 'percent';
}

/** One graphic flowing through the graph, with the steps accumulated so far. */
export interface Track {
	sourceId: string;
	kind: 'svg' | 'text';
	/** svg: inner markup. text: the string to render. */
	markup: string;
	text: string;
	/** svg: viewport size. text: font size. */
	size: number;
	fill: string;
	/** Static offsets from position nodes, composed in chain order. */
	offsets: PosOffset[];
	steps: AnimStep[];
}

export interface Evaluated {
	tracks: Track[];
	error: string | null;
}

function num(v: unknown, fallback: number): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function stepFor(node: Node): AnimStep | null {
	const d = node.data;
	if (node.type === 'scale') {
		return {
			kind: 'scale',
			amount: num(d.percent, 10),
			unit: 'percent',
			duration: num(d.duration, 1000)
		};
	}
	if (node.type === 'translate') {
		return {
			kind: 'translateX',
			amount: num(d.amount, 50),
			unit: d.unit === 'percent' ? 'percent' : 'px',
			duration: num(d.duration, 1000)
		};
	}
	if (node.type === 'rotate') {
		return {
			kind: 'rotate',
			amount: num(d.degrees, 90),
			unit: 'px',
			duration: num(d.duration, 1000)
		};
	}
	if (node.type === 'delay') {
		return { kind: 'wait', amount: 0, unit: 'px', duration: num(d.duration, 500) };
	}
	return null;
}

/** Handle ids: index 0 has no id, the rest are `<type>-<i>`. */
function handleIndex(handleId: string | null | undefined): number {
	const m = handleId?.match(/-(\d+)$/);
	return m ? Number(m[1]) : 0;
}

/**
 * Evaluate a preview node. Each input handle carries one wire, and on
 * transform nodes input i feeds output i — so tracks are routed by handle.
 * A preview merges the tracks from all of its input handles.
 */
export function evaluateGraph(previewId: string, nodes: Node[], edges: Edge[]): Evaluated {
	const visiting = new Set<string>();
	let error: string | null = null;

	function collect(nodeId: string, viaSourceHandle: string | null | undefined): Track[] {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node) return [];
		if (node.type === 'svgSource') {
			const d = node.data;
			return [
				{
					sourceId: node.id,
					kind: 'svg',
					markup: markupFor(d as SvgSourceData),
					text: '',
					size: Math.max(8, num(d.size, 120)),
					fill: '',
					offsets: [],
					steps: []
				}
			];
		}
		if (node.type === 'text') {
			const d = node.data;
			return [
				{
					sourceId: node.id,
					kind: 'text',
					markup: '',
					text: String(d.text ?? '') || 'Text',
					size: Math.max(8, num(d.fontSize, 36)),
					fill: String(d.fill ?? '#e6e8ee'),
					offsets: [],
					steps: []
				}
			];
		}
		if (visiting.has(nodeId)) {
			error ??= 'Cycle detected';
			return [];
		}

		let inputEdges: Edge[];
		if (node.type === 'preview' || node.type === 'position') {
			// merge points: every input track flows through the single output
			inputEdges = edges.filter((e) => e.target === nodeId);
		} else {
			// transform: the wire leaves out-i, so it carries only what entered in-i
			const idx = handleIndex(viaSourceHandle);
			const targetHandle = idx === 0 ? null : `target-${idx}`;
			inputEdges = edges.filter(
				(e) => e.target === nodeId && (e.targetHandle ?? null) === targetHandle
			);
		}

		visiting.add(nodeId);
		let tracks = inputEdges.flatMap((e) => collect(e.source, e.sourceHandle));
		visiting.delete(nodeId);
		if (node.type === 'position') {
			const d = node.data;
			const off: PosOffset = {
				x: num(d.x, 0),
				y: num(d.y, 0),
				unit: d.unit === 'px' ? 'px' : 'percent'
			};
			tracks = tracks.map((t) => ({ ...t, offsets: [...t.offsets, off] }));
		}
		const step = stepFor(node);
		return step ? tracks.map((t) => ({ ...t, steps: [...t.steps, step] })) : tracks;
	}

	const tracks = collect(previewId, null);
	if (tracks.length === 0) return { tracks, error: error ?? 'Connect an SVG source' };
	return { tracks, error };
}

/** Resolve composed static offsets to pixels against the stage size. */
export function resolveOffsets(offsets: PosOffset[], w: number, h: number): { x: number; y: number } {
	let x = 0;
	let y = 0;
	for (const o of offsets) {
		x += o.unit === 'percent' ? (o.x / 100) * w : o.x;
		y += o.unit === 'percent' ? (o.y / 100) * h : o.y;
	}
	return { x, y };
}

/**
 * Turn a track's steps into a WAAPI keyframe sequence. Steps compose: scales
 * multiply, translations add. `%` units resolve against the stage size, and
 * static position offsets form the base transform every keyframe builds on.
 * Plays once and holds the end state — no rewind.
 */
export function buildAnimation(
	track: Track,
	stageWidth: number,
	stageHeight: number
): { keyframes: Keyframe[]; options: KeyframeAnimationOptions } | null {
	if (track.steps.length === 0) return null;

	const base = resolveOffsets(track.offsets, stageWidth, stageHeight);
	const durations = track.steps.map((s) => Math.max(50, s.duration));
	const total = durations.reduce((a, b) => a + b, 0);

	let scale = 1;
	let tx = 0;
	let rot = 0;
	let elapsed = 0;

	const keyframes: Keyframe[] = [
		{
			offset: 0,
			transform: `translate(${base.x.toFixed(1)}px, ${base.y.toFixed(1)}px) rotate(0deg) scale(1)`,
			easing: 'ease-in-out'
		}
	];

	track.steps.forEach((s, i) => {
		elapsed += durations[i];
		if (s.kind === 'scale') {
			scale *= 1 + s.amount / 100;
		} else if (s.kind === 'translateX') {
			tx += s.unit === 'percent' ? (s.amount / 100) * stageWidth : s.amount;
		} else if (s.kind === 'rotate') {
			rot += s.amount;
		}
		// wait: transform unchanged, the segment just holds it
		keyframes.push({
			offset: elapsed / total,
			transform: `translate(${(base.x + tx).toFixed(1)}px, ${base.y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(4)})`,
			easing: 'ease-in-out'
		});
	});

	return {
		keyframes,
		options: { duration: total, iterations: 1, fill: 'forwards' }
	};
}
