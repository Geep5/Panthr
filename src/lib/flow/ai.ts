const PLAN_SYSTEM = `You plan professional flat vector illustrations for a 120x120 viewBox, in the style of premium logo art: the figure is built from a FEW flowing continuous paths, not from primitive shapes. Reply with ONLY a JSON array — no prose, no code fences. Plan 3 to 7 parts, in paint order:
1. First part: the COMPLETE SILHOUETTE of the subject — its entire outline (body, limbs, tail, head all in one) drawn as one continuous flowing line, in the main color.
2. Later parts: overlay shapes layered on top — secondary color masses, shading shapes, markings, highlights, then tiny details like eyes last.
Each item: {"name": "short part name", "desc": "one sentence: what it covers, its hex color, and its position/coordinates within the 0-120 canvas"}. Plan a palette of 2-4 colors total.`;

const STROKE_PLAN_SYSTEM = `You plan the pen strokes for ONE part of a professional flat vector illustration in viewBox "0 0 120 120". You are given the subject, the full part plan, the SVG drawn so far by earlier agents, and the part to detail. A stroke is ONE continuous flowing <path> — a single confident pen line, never a primitive shape. Most parts need exactly 1 stroke; use more only for genuinely separate marks. Reply with ONLY a JSON array — no prose, no code fences. Each item: {"name": "short stroke name", "desc": "what it is + what areas/parts it connects to + the route the pen line travels through the 0-120 canvas + hex color"}. Plan routes that connect precisely with what is already drawn.`;

const STROKE_SYSTEM = `You are one agent in a relay, each drawing exactly ONE pen stroke of a professional flat vector illustration inside viewBox "0 0 120 120". Previous agents drew the SVG you are given; you add your single stroke.

STYLE — this is the quality bar, a real example of one stroke from a professional panther logo (one continuous line of smooth cubic curves):
<path fill="#6A19C0" d="m96 10.4c-1 1-1.1 1.7-3.5 2.1-1.6 0.6-1.6 3.3-3.6 3.6-1.9 0.2-1 2.3-2.5 3.3-2.2 0.9-1.9 2.2-3.3 2.7-2-0.1-2 0.4-2.2 3.5-1 1.7-1.8 1-1.8 2.9-1.3 1.2-1.4 0.5-1.6 2.4-2.4 1.5-1.6 2.1-1.8 3.3l-2.1 2.3c-0.8 1.2 0.3 2.6-1 3.2-1.3 0.7-1.5 1.5-1.5 2l-2.4 3.7c0.6-0.1 3.4-2.6 4.5-3 0.4-0.9 0-2 1.9-2.6 1.3-0.4 0.5-2.1 2.6-2.8 1.2-0.4 0.2-1.8 2.5-3 2.6-1.5 1.8-1.6 2.2-3.2 0.6-1.3 1.9-1.1 1.9-3 0-2.4 3.6-0.7 3.6-4.5 0.2-2.4 2-1.9 2.6-3.3 1-1.6 1.7-2 2.5-3.1l1.6-2.2c1-1.1 6.3-5.2 7-6.9-1.2 0.5-3.9 2.1-5.5 2.4l-0.1 0.2z"/>

RULES:
- Output exactly ONE <path> element with a "d" of many smooth cubic curves (c/s commands) tracing one continuous closed line, and a flat fill. Rich, organic, varied curvature — like the example.
- NEVER use ellipse, circle, rect, polygon, or line elements. NEVER build from a few chunky segments — a good stroke has 15-60 curve commands.
- Trace the existing edges your stroke must meet in the SVG so far and align your curve to them.
- Reply with ONLY that one <path> — no <svg> wrapper, no code fences, no prose.`;

/** Resolve the Anthropic API key: build-time env first, then localStorage. */
export function apiKey(): string {
	return (
		(import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ??
		localStorage.getItem('panthr-anthropic-key') ??
		''
	);
}

async function fable(system: string, user: string, key: string, maxTokens: number): Promise<string> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': key,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: 'claude-fable-5',
			max_tokens: maxTokens,
			system,
			messages: [{ role: 'user', content: user }]
		})
	});
	if (!res.ok) {
		throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
	}
	const json = await res.json();
	return (
		json.content
			?.filter((b: { type: string }) => b.type === 'text')
			.map((b: { text: string }) => b.text)
			.join('') ?? ''
	);
}

const stripFences = (t: string) => t.replace(/```(?:svg|xml|html|json)?/g, '').trim();

/** Unwrap a full <svg> document, rescaling its viewBox onto 0 0 120 120. */
function unwrapSvg(text: string): string {
	const wrapper = text.match(/<svg([^>]*)>([\s\S]*)<\/svg>/i);
	if (!wrapper) return text;
	let inner = wrapper[2].trim();
	const vb = wrapper[1].match(
		/viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)/i
	);
	if (vb) {
		const [, x, y, w, h] = vb.map(Number);
		const s = 120 / Math.max(w || 120, h || 120);
		if (x || y || Math.abs(s - 1) > 0.001) {
			inner = `<g transform="scale(${s.toFixed(4)}) translate(${(-x).toFixed(2)}, ${(-y).toFixed(2)})">${inner}</g>`;
		}
	}
	return inner;
}

interface PlanPart {
	name: string;
	desc: string;
}

function parsePlan(text: string): PlanPart[] {
	const t = stripFences(text);
	const m = t.match(/\[[\s\S]*\]/);
	const raw: unknown = JSON.parse(m ? m[0] : t);
	const arr =
		Array.isArray(raw) ? raw
		: raw && typeof raw === 'object' && 'parts' in raw && Array.isArray(raw.parts) ? raw.parts
		: null;
	if (!arr || arr.length === 0) throw new Error('no parts');
	return arr.slice(0, 30).map((p: unknown): PlanPart => {
		const obj: object = p && typeof p === 'object' ? p : {};
		const name = 'name' in obj && typeof obj.name === 'string' ? obj.name : 'part';
		const desc =
			'desc' in obj && typeof obj.desc === 'string' ? obj.desc
			: 'description' in obj && typeof obj.description === 'string' ? obj.description
			: '';
		return { name, desc };
	});
}

/**
 * Three-tier generation, fully sequential to carry the design forward.
 * A part planner splits the subject into parts in paint order. Then, part
 * by part: a stroke planner decides that part's individual strokes (1-30:
 * perimeter, markings, ...) seeing the SVG built so far, and every stroke
 * gets its own fresh builder agent, one after the other, each seeing the
 * work of all agents before it.
 */
export async function generateSvg(
	prompt: string,
	key: string,
	onProgress?: (msg: string) => void
): Promise<string> {
	onProgress?.('planning parts…');
	let parts: PlanPart[];
	try {
		parts = parsePlan(await fable(PLAN_SYSTEM, prompt, key, 2000));
	} catch {
		parts = [{ name: 'whole drawing', desc: prompt }];
	}

	const planList = parts.map((q, j) => `${j + 1}. ${q.name} — ${q.desc}`).join('\n');
	let markup = '';

	for (const [i, p] of parts.entries()) {
		const where = `${p.name} (${i + 1}/${parts.length})`;

		onProgress?.(`planning strokes for ${where}…`);
		let strokes: PlanPart[];
		try {
			strokes = parsePlan(
				await fable(
					STROKE_PLAN_SYSTEM,
					`Subject: ${prompt}

Part plan:
${planList}

SVG so far (inside <svg viewBox="0 0 120 120">):
${markup || '(empty — nothing drawn yet)'}

Plan the strokes for part ${i + 1}: ${p.name} — ${p.desc}`,
					key,
					2000
				)
			);
		} catch {
			strokes = [{ name: p.name, desc: p.desc }];
		}

		const strokeList = strokes.map((q, k) => `${k + 1}. ${q.name} — ${q.desc}`).join('\n');
		let partMarkup = '';
		for (const [j, s] of strokes.entries()) {
			onProgress?.(`${where} · ${s.name} (stroke ${j + 1}/${strokes.length})…`);
			const user = `Subject: ${prompt}

Current part: ${p.name} — ${p.desc}

Stroke plan for this part:
${strokeList}

SVG so far (inside <svg viewBox="0 0 120 120">):
${(markup + partMarkup) || '(empty — you are drawing the first stroke)'}

Draw ONLY stroke ${j + 1}: ${s.name} — ${s.desc}`;
			const piece = unwrapSvg(stripFences(await fable(STROKE_SYSTEM, user, key, 5000)));
			if (piece) partMarkup += piece;
		}

		if (partMarkup) markup += `<g data-part="${p.name.replace(/[^\w -]/g, '')}">${partMarkup}</g>`;
	}

	if (!markup) throw new Error('Model returned no SVG');
	return markup;
}
