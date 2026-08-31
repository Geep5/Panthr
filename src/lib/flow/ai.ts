const PLAN_SYSTEM = `You plan flat vector illustrations for a 120x120 viewBox. Reply with ONLY a JSON array — no prose, no code fences. List the parts needed to draw the subject, in paint order (furthest back first: e.g. far-side legs before body, body before head, eyes last). 6 to 12 parts. Each item: {"name": "short part name", "desc": "one sentence: its shape, flat color, and position/coordinates within the 0-120 canvas"}. Plan coordinates so the parts connect into one coherent figure that fills most of the canvas.`;

const STROKE_PLAN_SYSTEM = `You plan the individual strokes for ONE part of a flat vector illustration in viewBox "0 0 120 120". You are given the subject, the full part plan, and the part to detail. Reply with ONLY a JSON array — no prose, no code fences — of the strokes needed for that single part, in paint order. A stroke is one SVG element to draw: e.g. a hoof's perimeter shape, then its inner marking. Use 1-3 strokes for simple parts and up to 30 for detailed ones. Each item: {"name": "short stroke name", "desc": "one sentence: element type, shape/coordinates in the 0-120 canvas, hex color"}. Follow the part plan's coordinates exactly so all parts' strokes assemble into one coherent figure.`;

const STROKE_SYSTEM = `You are one agent in a relay of agents, each drawing exactly ONE stroke of a flat vector illustration inside viewBox "0 0 120 120". A stroke is a single SVG element (path/polygon/ellipse/rect etc.). Previous agents drew the SVG you are given; agents after you draw the remaining strokes. You are given the subject, the part being drawn, that part's stroke plan, the SVG so far, and the single stroke YOU own. Reply with ONLY that one SVG element — no <svg> wrapper, no code fences, no prose, no other strokes. Match the plan's coordinates and the palette of what is already drawn.`;

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
 * Three-tier generation. A part planner splits the subject into parts in
 * paint order. Then one stroke planner per part decides its individual
 * strokes (1-30: perimeter, markings, ...) — the planners run in parallel,
 * planning from the blueprint's coordinates. Finally every stroke gets its
 * own fresh builder agent, strictly one after the other, each seeing the
 * SVG built so far.
 */
export async function generateSvg(
	prompt: string,
	key: string,
	onProgress?: (msg: string) => void
): Promise<string> {
	onProgress?.('planning parts…');
	let parts: PlanPart[];
	try {
		parts = parsePlan(await fable(PLAN_SYSTEM, prompt, key, 1500));
	} catch {
		parts = [{ name: 'whole drawing', desc: prompt }];
	}

	const planList = parts.map((q, j) => `${j + 1}. ${q.name} — ${q.desc}`).join('\n');

	// one stroke planner per part, all in parallel — only builders are sequential
	onProgress?.(`planning strokes (${parts.length} planners)…`);
	const strokePlans = await Promise.all(
		parts.map(async (p, i) => {
			try {
				return parsePlan(
					await fable(
						STROKE_PLAN_SYSTEM,
						`Subject: ${prompt}

Part plan:
${planList}

Plan the strokes for part ${i + 1}: ${p.name} — ${p.desc}`,
						key,
						2000
					)
				);
			} catch {
				return [{ name: p.name, desc: p.desc }];
			}
		})
	);

	const totalStrokes = strokePlans.reduce((a, s) => a + s.length, 0);
	let markup = '';
	let done = 0;

	for (const [i, p] of parts.entries()) {
		const strokes = strokePlans[i];
		const strokeList = strokes.map((q, k) => `${k + 1}. ${q.name} — ${q.desc}`).join('\n');
		let partMarkup = '';
		for (const [j, s] of strokes.entries()) {
			done += 1;
			onProgress?.(`${p.name} · ${s.name} (${done}/${totalStrokes})…`);
			const user = `Subject: ${prompt}

Current part: ${p.name} — ${p.desc}

Stroke plan for this part:
${strokeList}

SVG so far (inside <svg viewBox="0 0 120 120">):
${(markup + partMarkup) || '(empty — you are drawing the first stroke)'}

Draw ONLY stroke ${j + 1}: ${s.name} — ${s.desc}`;
			const piece = unwrapSvg(stripFences(await fable(STROKE_SYSTEM, user, key, 1500)));
			if (piece) partMarkup += piece;
		}

		if (partMarkup) markup += `<g data-part="${p.name.replace(/[^\w -]/g, '')}">${partMarkup}</g>`;
	}

	if (!markup) throw new Error('Model returned no SVG');
	return markup;
}
