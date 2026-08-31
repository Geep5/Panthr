import { resolveOffsets, type Track } from './evaluate';

const FR = 60;
const frames = (ms: number) => Math.max(1, Math.round(ms * (FR / 1000)));

const ESC: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
};

interface Kf {
	t: number;
	s: number[];
	o?: { x: number[]; y: number[] };
	i?: { x: number[]; y: number[] };
}

/** Static value when nothing changes, eased keyframes otherwise. */
function prop(kfs: Kf[]): Record<string, unknown> {
	const dims = kfs[0].s.length;
	const animated = kfs.some((k) => k.s.some((v, d) => v !== kfs[0].s[d]));
	if (!animated) return { a: 0, k: dims === 1 ? kfs[0].s[0] : kfs[0].s };
	const ease = Array(dims).fill(0);
	const k = kfs.map((kf, idx) =>
		idx < kfs.length - 1
			? {
					...kf,
					o: { x: ease.map(() => 0.42), y: ease.map(() => 0) },
					i: { x: ease.map(() => 0.58), y: ease.map(() => 1) }
				}
			: kf
	);
	return { a: 1, k };
}

/** Wrap a track's graphic as a standalone SVG document for a Lottie image asset. */
function trackSvg(track: Track): { svg: string; w: number; h: number } {
	if (track.kind === 'text') {
		const text = track.text.replace(/[&<>"']/g, (c) => ESC[c]);
		const w = Math.max(12, Math.ceil(track.text.length * track.size * 0.62));
		const h = Math.ceil(track.size * 1.3);
		return {
			svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><text x="${w / 2}" y="${h * 0.76}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${track.size}" fill="${track.fill}">${text}</text></svg>`,
			w,
			h
		};
	}
	const s = track.size;
	return {
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">${track.markup}</svg>`,
		w: s,
		h: s
	};
}

/**
 * Compile tracks into a Lottie (bodymovin) animation. Each track becomes an
 * image layer whose asset is its SVG embedded as a data URI; steps become
 * eased transform keyframes on position/scale/rotation, and delays hold.
 */
export function buildLottie(
	tracks: Track[],
	w: number,
	h: number
): { animationData: Record<string, unknown>; frames: number } {
	let op = 1;
	const assets: Record<string, unknown>[] = [];
	const layers: Record<string, unknown>[] = [];

	tracks.forEach((track, i) => {
		const doc = trackSvg(track);
		const assetId = `panthr_${i}`;
		assets.push({
			id: assetId,
			w: doc.w,
			h: doc.h,
			u: '',
			p: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(doc.svg))),
			e: 1
		});

		const base = resolveOffsets(track.offsets, w, h);
		const cx = w / 2 + base.x;
		const cy = h / 2 + base.y;

		let t = 0;
		let x = cx;
		let scale = 100;
		let rot = 0;
		const pk: Kf[] = [{ t: 0, s: [cx, cy, 0] }];
		const sk: Kf[] = [{ t: 0, s: [100, 100, 100] }];
		const rk: Kf[] = [{ t: 0, s: [0] }];

		for (const step of track.steps) {
			t += frames(step.duration);
			if (step.kind === 'translateX') {
				x += step.unit === 'percent' ? (step.amount / 100) * w : step.amount;
			} else if (step.kind === 'scale') {
				scale *= 1 + step.amount / 100;
			} else if (step.kind === 'rotate') {
				rot += step.amount;
			}
			pk.push({ t, s: [x, cy, 0] });
			sk.push({ t, s: [scale, scale, 100] });
			rk.push({ t, s: [rot] });
		}
		op = Math.max(op, t);

		layers.push({
			ddd: 0,
			ind: i + 1,
			ty: 2,
			nm: track.sourceId,
			refId: assetId,
			sr: 1,
			ks: {
				o: { a: 0, k: 100 },
				r: prop(rk),
				p: prop(pk),
				a: { a: 0, k: [doc.w / 2, doc.h / 2, 0] },
				s: prop(sk)
			},
			ao: 0,
			ip: 0,
			op: 0, // patched below once the composition length is known
			st: 0
		});
	});

	layers.forEach((l) => {
		l.op = op;
	});

	return {
		animationData: {
			v: '5.7.4',
			fr: FR,
			ip: 0,
			op,
			w,
			h,
			nm: 'Panthr',
			ddd: 0,
			assets,
			layers,
			markers: []
		},
		frames: op
	};
}
