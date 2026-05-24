/**
 * tldraw <-> backend Shape bridge for a0_whiteboard.
 *
 * Backend shape dataclass (helpers/whiteboard.py):
 *   { id, type, x, y, w, h, r, points: number[], props: { text, color,
 *     strokeWidth, fill, fontSize } }
 * Supported backend types: text, line, rect/rectangle, ellipse/circle, arrow.
 *
 * tldraw v3.x records: { id, type, x, y, props: {...}, ... }
 * Supported tldraw types used here: geo (rectangle, ellipse), text, draw,
 * arrow. See https://tldraw.dev for the editor API.
 *
 * Color mapping: backend stores hex; tldraw v3 uses named tokens. We
 * approximate via a small nearest-name table — fidelity is acceptable
 * because each engine renders independently from the server's perspective.
 */

const TLDRAW_COLOR_NAMES = ['black', 'grey', 'light-violet', 'violet', 'blue',
    'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'];

const TLDRAW_COLOR_HEX = {
    'black': '#1d1d1d',
    'grey': '#9fa8b2',
    'light-violet': '#e085f4',
    'violet': '#ae3ec9',
    'blue': '#4263eb',
    'light-blue': '#4dabf7',
    'yellow': '#ffc638',
    'orange': '#ff8a4c',
    'green': '#36b24d',
    'light-green': '#40c057',
    'light-red': '#ff8787',
    'red': '#e03131',
    'white': '#f5f5f5',
};

const SIZE_BUCKETS = [
    [12, 's'],
    [18, 'm'],
    [28, 'l'],
    [48, 'xl'],
];

function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function hexToTldrawColor(hex) {
    const rgb = hexToRgb(hex || '#ffffff');
    if (!rgb) return 'white';
    let best = 'white';
    let bestDist = Infinity;
    for (const name of TLDRAW_COLOR_NAMES) {
        const tRgb = hexToRgb(TLDRAW_COLOR_HEX[name]);
        if (!tRgb) continue;
        const d = (rgb[0] - tRgb[0]) ** 2 + (rgb[1] - tRgb[1]) ** 2 + (rgb[2] - tRgb[2]) ** 2;
        if (d < bestDist) { bestDist = d; best = name; }
    }
    return best;
}

export function tldrawColorToHex(name) {
    return TLDRAW_COLOR_HEX[name] || '#ffffff';
}

export function sizeBucket(px) {
    const v = Number(px) || 18;
    for (const [limit, name] of SIZE_BUCKETS) {
        if (v <= limit) return name;
    }
    return 'xl';
}

export function bucketToPx(bucket) {
    switch (bucket) {
        case 's': return 12;
        case 'm': return 18;
        case 'l': return 28;
        case 'xl': return 48;
        default: return 18;
    }
}

function pairsToPoints(points) {
    const out = [];
    if (!Array.isArray(points)) return out;
    for (let i = 0; i + 1 < points.length; i += 2) {
        out.push({ x: Number(points[i]) || 0, y: Number(points[i + 1]) || 0 });
    }
    return out;
}

function pointsToFlat(points) {
    const out = [];
    if (!Array.isArray(points)) return out;
    for (const p of points) {
        out.push(Number(p?.x) || 0, Number(p?.y) || 0);
    }
    return out;
}

/** Backend Shape -> tldraw TLShape partial (suitable for editor.createShapes). */
export function toTLShape(shape) {
    if (!shape || typeof shape !== 'object') return null;
    const id = shape.id && String(shape.id).startsWith('shape:')
        ? shape.id
        : `shape:${shape.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))}`;
    const x = Number(shape.x) || 0;
    const y = Number(shape.y) || 0;
    const p = shape.props || {};
    const color = hexToTldrawColor(p.color);
    const size = sizeBucket(p.fontSize || p.strokeWidth);
    const fill = p.fill && p.fill !== 'transparent' ? 'solid' : 'none';

    const type = String(shape.type || '').toLowerCase();
    switch (type) {
        case 'rect':
        case 'rectangle':
            return {
                id, type: 'geo', x, y,
                props: {
                    geo: 'rectangle',
                    w: Number(shape.w) || 100,
                    h: Number(shape.h) || 60,
                    color, fill, size,
                    text: p.text || '',
                },
            };
        case 'ellipse':
        case 'circle': {
            const w = Number(shape.w) || (Number(shape.r) || 50) * 2;
            const h = Number(shape.h) || (Number(shape.r) || 50) * 2;
            return {
                id, type: 'geo', x, y,
                props: { geo: 'ellipse', w, h, color, fill, size, text: p.text || '' },
            };
        }
        case 'text':
            return {
                id, type: 'text', x, y,
                props: { color, size, text: p.text || '' },
            };
        case 'arrow':
            return {
                id, type: 'arrow', x, y,
                props: {
                    color, size,
                    start: { x: 0, y: 0 },
                    end: { x: Number(shape.w) || 100, y: Number(shape.h) || 0 },
                },
            };
        case 'line':
        case 'draw':
        default: {
            const pts = pairsToPoints(shape.points);
            if (!pts.length) pts.push({ x: 0, y: 0 });
            return {
                id, type: 'draw', x, y,
                props: {
                    color, size,
                    segments: [{ type: 'free', points: pts }],
                    isComplete: true,
                    isClosed: false,
                },
            };
        }
    }
}

/** tldraw TLShape -> backend Shape dict. */
export function fromTLShape(tl) {
    if (!tl || typeof tl !== 'object') return null;
    const id = String(tl.id || '');
    const x = Number(tl.x) || 0;
    const y = Number(tl.y) || 0;
    const props = tl.props || {};
    const color = tldrawColorToHex(props.color);
    const fontSize = bucketToPx(props.size);

    const baseProps = {
        text: props.text || '',
        color,
        strokeWidth: 2,
        fill: props.fill === 'solid' ? color : 'transparent',
        fontSize,
    };

    switch (tl.type) {
        case 'geo':
            if (props.geo === 'ellipse') {
                return { id, type: 'ellipse', x, y, w: props.w, h: props.h, props: baseProps };
            }
            return { id, type: 'rect', x, y, w: props.w, h: props.h, props: baseProps };
        case 'text':
            return { id, type: 'text', x, y, props: baseProps };
        case 'arrow': {
            const dx = (props.end?.x ?? 100) - (props.start?.x ?? 0);
            const dy = (props.end?.y ?? 0) - (props.start?.y ?? 0);
            return { id, type: 'arrow', x, y, w: dx, h: dy, props: baseProps };
        }
        case 'draw':
        case 'line': {
            const seg = Array.isArray(props.segments) && props.segments[0];
            const pts = seg ? pointsToFlat(seg.points) : [];
            return { id, type: 'line', x, y, points: pts, props: baseProps };
        }
        default:
            return null;
    }
}

export function shapesToTLShapes(shapes) {
    if (!Array.isArray(shapes)) return [];
    return shapes.map(toTLShape).filter(Boolean);
}

export function tlShapesToShapes(tlShapes) {
    if (!Array.isArray(tlShapes)) return [];
    return tlShapes.map(fromTLShape).filter(Boolean);
}
