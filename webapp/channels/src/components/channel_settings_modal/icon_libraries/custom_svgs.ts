// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Custom SVG definition
export type CustomSvg = {
    id: string;
    name: string;
    svg: string; // Base64-encoded SVG content
    normalizeColor: boolean; // Whether to replace fill/stroke colors with currentColor
    createdAt: number;
};

// Storage key prefix
const STORAGE_KEY_PREFIX = 'mattermost_custom_svgs_';

// Get storage key for current user
function getStorageKey(userId: string): string {
    return `${STORAGE_KEY_PREFIX}${userId}`;
}

// Generate a unique ID for a new custom SVG
export function generateCustomSvgId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Get all custom SVGs for a user
export function getCustomSvgs(userId: string): CustomSvg[] {
    try {
        const data = localStorage.getItem(getStorageKey(userId));
        if (!data) {
            return [];
        }
        return JSON.parse(data) as CustomSvg[];
    } catch {
        return [];
    }
}

// Get a specific custom SVG by ID
export function getCustomSvgById(userId: string, id: string): CustomSvg | undefined {
    const svgs = getCustomSvgs(userId);
    return svgs.find((svg) => svg.id === id);
}

// Get a custom SVG by name (for display purposes)
export function getCustomSvgByName(userId: string, name: string): CustomSvg | undefined {
    const svgs = getCustomSvgs(userId);
    return svgs.find((svg) => svg.name.toLowerCase() === name.toLowerCase());
}

// Save all custom SVGs for a user
export function saveCustomSvgs(userId: string, svgs: CustomSvg[]): void {
    try {
        localStorage.setItem(getStorageKey(userId), JSON.stringify(svgs));
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to save custom SVGs:', error);
    }
}

// Add a new custom SVG
export function addCustomSvg(userId: string, svg: Omit<CustomSvg, 'id' | 'createdAt'>): CustomSvg {
    const svgs = getCustomSvgs(userId);
    const newSvg: CustomSvg = {
        ...svg,
        id: generateCustomSvgId(),
        createdAt: Date.now(),
    };
    svgs.push(newSvg);
    saveCustomSvgs(userId, svgs);
    return newSvg;
}

// Update an existing custom SVG
export function updateCustomSvg(userId: string, id: string, updates: Partial<Omit<CustomSvg, 'id' | 'createdAt'>>): CustomSvg | undefined {
    const svgs = getCustomSvgs(userId);
    const index = svgs.findIndex((svg) => svg.id === id);
    if (index === -1) {
        return undefined;
    }
    svgs[index] = {...svgs[index], ...updates};
    saveCustomSvgs(userId, svgs);
    return svgs[index];
}

// Delete a custom SVG
export function deleteCustomSvg(userId: string, id: string): boolean {
    const svgs = getCustomSvgs(userId);
    const index = svgs.findIndex((svg) => svg.id === id);
    if (index === -1) {
        return false;
    }
    svgs.splice(index, 1);
    saveCustomSvgs(userId, svgs);
    return true;
}

// Normalize SVG colors (replace fill/stroke with currentColor)
export function normalizeSvgColors(svgContent: string): string {
    // Replace fill and stroke colors with currentColor
    // This regex matches fill="..." and stroke="..." attributes
    // excluding "none" and "transparent" values
    return svgContent
        .replace(/fill\s*=\s*["'](?!none|transparent)[^"']*["']/gi, 'fill="currentColor"')
        .replace(/stroke\s*=\s*["'](?!none|transparent)[^"']*["']/gi, 'stroke="currentColor"')
        // Also handle inline styles
        .replace(/fill\s*:\s*(?!none|transparent)[^;}"']+/gi, 'fill: currentColor')
        .replace(/stroke\s*:\s*(?!none|transparent)[^;}"']+/gi, 'stroke: currentColor');
}

// Validate SVG content
export function validateSvg(content: string): {valid: boolean; error?: string} {
    // Must start with <svg or have <svg somewhere
    if (!content.includes('<svg')) {
        return {valid: false, error: 'Content must be valid SVG (must contain <svg tag)'};
    }

    // Must close the svg tag
    if (!content.includes('</svg>') && !content.includes('/>')) {
        return {valid: false, error: 'SVG tag must be properly closed'};
    }

    // Check for potentially dangerous content
    if (/<script/i.test(content)) {
        return {valid: false, error: 'SVG cannot contain script tags'};
    }
    if (/on\w+\s*=/i.test(content)) {
        return {valid: false, error: 'SVG cannot contain event handlers'};
    }
    if (/javascript:/i.test(content)) {
        return {valid: false, error: 'SVG cannot contain javascript: URLs'};
    }

    return {valid: true};
}

// Parse SVG to extract viewBox dimensions
export function extractSvgViewBox(content: string): {x: number; y: number; width: number; height: number} | null {
    const viewBoxMatch = content.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/).map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
            return {x: parts[0], y: parts[1], width: parts[2], height: parts[3]};
        }
    }

    // Try to extract from width/height
    const widthMatch = content.match(/\bwidth\s*=\s*["'](\d+)/i);
    const heightMatch = content.match(/\bheight\s*=\s*["'](\d+)/i);
    if (widthMatch && heightMatch) {
        return {x: 0, y: 0, width: parseInt(widthMatch[1], 10), height: parseInt(heightMatch[1], 10)};
    }

    return null;
}

// Encode SVG to base64
export function encodeSvgToBase64(svg: string): string {
    try {
        return btoa(unescape(encodeURIComponent(svg)));
    } catch {
        return btoa(svg);
    }
}

// Decode base64 to SVG
export function decodeSvgFromBase64(base64: string): string {
    try {
        return decodeURIComponent(escape(atob(base64)));
    } catch {
        try {
            return atob(base64);
        } catch {
            return '';
        }
    }
}

// Format the icon value for storage in channel props
export function formatCustomSvgValue(id: string): string {
    return `customsvg:${id}`;
}

// Parse a customsvg: value to get the ID
export function parseCustomSvgValue(value: string): string | null {
    if (value.startsWith('customsvg:')) {
        return value.slice(10);
    }
    return null;
}

// Sanitize SVG content for safe rendering
export function sanitizeSvg(content: string): string {
    return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '');
}

// Extract inner content of SVG (everything inside <svg>...</svg>)
export function extractSvgInnerContent(content: string): string {
    const match = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    return match ? match[1].trim() : '';
}
