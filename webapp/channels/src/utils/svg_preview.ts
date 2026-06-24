// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type ContentBounds = {x: number; y: number; width: number; height: number};

// resolveSvgWithViewBox fetches an SVG that lacks usable sizing information and,
// when possible, returns an object URL for an equivalent SVG with a viewBox
// injected from the rendered content bounds. SVGs without a viewBox cannot be
// scaled by CSS, so the browser draws their content at 1:1 and clips it; adding a
// viewBox lets the preview fill the available space instead. Returns null when the
// SVG already scales correctly or when its bounds cannot be measured.
export async function resolveSvgWithViewBox(src: string): Promise<string | null> {
    if (typeof document === 'undefined' || typeof fetch !== 'function') {
        return null;
    }

    let markup: string;
    try {
        const response = await fetch(src);
        if (!response.ok) {
            return null;
        }
        markup = await response.text();
    } catch {
        return null;
    }

    const svg = parseSvg(markup);
    if (!svg) {
        return null;
    }

    // Anything with a viewBox or absolute width and height already scales correctly.
    if (svg.getAttribute('viewBox') ||
        (hasAbsoluteLength(svg.getAttribute('width')) && hasAbsoluteLength(svg.getAttribute('height')))) {
        return null;
    }

    const bounds = measureContentBounds(svg);
    if (!bounds) {
        return null;
    }

    const x = Math.floor(bounds.x);
    const y = Math.floor(bounds.y);
    const width = Math.ceil(bounds.width);
    const height = Math.ceil(bounds.height);

    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const serialized = new XMLSerializer().serializeToString(svg);
    return URL.createObjectURL(new Blob([serialized], {type: 'image/svg+xml'}));
}

function parseSvg(markup: string): SVGSVGElement | null {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        return null;
    }

    const root = doc.documentElement;
    if (root.namespaceURI !== SVG_NAMESPACE || root.tagName.toLowerCase() !== 'svg') {
        return null;
    }

    return root as unknown as SVGSVGElement;
}

function measureContentBounds(svg: SVGSVGElement): ContentBounds | null {
    // getBBox only reports content extent for an element in the render tree, so
    // render an inert, sanitized clone off-screen to measure it.
    const node = svg.cloneNode(true) as SVGSVGElement;
    sanitize(node);
    node.setAttribute('style', 'position:absolute;left:-99999px;top:0;visibility:hidden;');

    document.body.appendChild(node);
    try {
        const bbox = node.getBBox();
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
            return null;
        }
        return {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
    } catch {
        return null;
    } finally {
        node.remove();
    }
}

// sanitize strips active content from the throwaway measurement node since it is
// briefly attached to the live document. The displayed preview keeps using an
// <img>, which never executes embedded SVG scripts.
function sanitize(element: Element) {
    element.querySelectorAll('script').forEach((script) => script.remove());
    removeEventHandlers(element);
}

function removeEventHandlers(element: Element) {
    for (const attr of Array.from(element.attributes)) {
        if (attr.name.toLowerCase().startsWith('on')) {
            element.removeAttribute(attr.name);
        }
    }
    for (const child of Array.from(element.children)) {
        removeEventHandlers(child);
    }
}

function hasAbsoluteLength(value: string | null): boolean {
    if (value === null) {
        return false;
    }
    const trimmed = value.trim();
    return trimmed !== '' && !trimmed.endsWith('%');
}
