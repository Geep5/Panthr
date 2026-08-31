import ImageTracer from 'imagetracerjs';

/**
 * Source images live only in memory (raw pixels are too big for the saved
 * board); re-upload after a reload to re-trace with new settings.
 */
const imageCache = new Map<string, ImageData>();

export function cacheImage(nodeId: string, data: ImageData): void {
	imageCache.set(nodeId, data);
}

export function cachedImage(nodeId: string): ImageData | undefined {
	return imageCache.get(nodeId);
}

/** Decode and downscale an image file for tracing. */
export async function fileToImageData(file: File, maxDim = 320): Promise<ImageData> {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		const decoded = Promise.withResolvers<void>();
		img.onload = () => decoded.resolve();
		img.onerror = () => decoded.reject(new Error('Could not decode image'));
		img.src = url;
		await decoded.promise;
		const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
		const w = Math.max(1, Math.round((img.width || 1) * scale));
		const h = Math.max(1, Math.round((img.height || 1) * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas unavailable');
		ctx.drawImage(img, 0, 0, w, h);
		return ctx.getImageData(0, 0, w, h);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Trace pixels into layered SVG paths, normalized to fit the standard
 * 0 0 120 120 track viewBox (contain, centered). `smooth` (0-10) trades
 * fidelity for stylization: higher tolerances, larger speck removal, and
 * pre-blur at the high end.
 */
export function traceImageData(data: ImageData, colors: number, smooth = 0): string {
	const s10 = Math.max(0, Math.min(10, Math.round(smooth) || 0));
	const svg = ImageTracer.imagedataToSVG(data, {
		numberofcolors: Math.max(2, Math.min(32, Math.round(colors) || 8)),
		pathomit: 8 + s10 * 8,
		ltres: 1 + s10 * 0.8,
		qtres: 1 + s10 * 0.8,
		blurradius: s10 >= 4 ? Math.min(5, s10 / 2) : 0,
		blurdelta: 20,
		strokewidth: 0,
		linefilter: true,
		roundcoords: 1,
		viewbox: true
	});
	const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
	const inner = m ? m[1].trim() : svg;
	const s = 120 / Math.max(data.width, data.height);
	const dx = (120 - data.width * s) / 2;
	const dy = (120 - data.height * s) / 2;
	return `<g transform="translate(${dx.toFixed(2)}, ${dy.toFixed(2)}) scale(${s.toFixed(4)})">${inner}</g>`;
}
