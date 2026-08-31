const SYSTEM = `You generate SVG artwork. Reply with ONLY SVG inner markup (paths, shapes, groups) that fits viewBox "0 0 120 120" — no <svg> wrapper, no code fences, no prose. Bold, flat-color, simple vector style. Center the subject and use most of the canvas.`;

/** Resolve the OpenAI API key: build-time env first, then localStorage. */
export function apiKey(): string {
	return (
		(import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ??
		localStorage.getItem('panthr-openai-key') ??
		''
	);
}

/** Generate SVG inner markup (viewBox 0 0 120 120) for a prompt. */
export async function generateSvg(prompt: string, key: string): Promise<string> {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
		body: JSON.stringify({
			model: 'gpt-4o',
			max_tokens: 3000,
			messages: [
				{ role: 'system', content: SYSTEM },
				{ role: 'user', content: prompt }
			]
		})
	});
	if (!res.ok) {
		throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
	}
	const json = await res.json();
	let text: string = json.choices?.[0]?.message?.content ?? '';
	text = text.replace(/```(?:svg|xml|html)?/g, '').trim();

	// unwrap a full <svg> document, rescaling its viewBox onto 0 0 120 120
	const wrapper = text.match(/<svg([^>]*)>([\s\S]*)<\/svg>/i);
	if (wrapper) {
		let inner = wrapper[2].trim();
		const vb = wrapper[1].match(/viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)/i);
		if (vb) {
			const [, x, y, w, h] = vb.map(Number);
			const s = 120 / Math.max(w || 120, h || 120);
			if (x || y || Math.abs(s - 1) > 0.001) {
				inner = `<g transform="scale(${s.toFixed(4)}) translate(${(-x).toFixed(2)}, ${(-y).toFixed(2)})">${inner}</g>`;
			}
		}
		text = inner;
	}

	if (!text) throw new Error('Model returned no SVG');
	return text;
}
