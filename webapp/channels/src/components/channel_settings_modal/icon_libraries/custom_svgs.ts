// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomChannelIcon} from '@mattermost/types/custom_channel_icons';

import {Client4} from 'mattermost-redux/client';

// Custom SVG definition (for local storage fallback)
export type CustomSvg = {
    id: string;
    name: string;
    svg: string; // Base64-encoded SVG content
    normalizeColor: boolean; // Whether to replace fill/stroke colors with currentColor
    createdAt: number;
};

// Storage key prefix for localStorage fallback
const STORAGE_KEY_PREFIX = 'mattermost_custom_svgs_';

// Get storage key for current user
function getStorageKey(userId: string): string {
    return `${STORAGE_KEY_PREFIX}${userId}`;
}

// Generate a unique ID for a new custom SVG
export function generateCustomSvgId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Convert server icon to local CustomSvg format
function serverIconToCustomSvg(icon: CustomChannelIcon): CustomSvg {
    return {
        id: icon.id,
        name: icon.name,
        svg: icon.svg,
        normalizeColor: icon.normalize_color,
        createdAt: icon.create_at,
    };
}

// Get all custom SVGs for a user (localStorage fallback)
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

// Get all custom SVGs from server
export async function getCustomSvgsFromServer(): Promise<CustomSvg[]> {
    try {
        const icons = await Client4.getCustomChannelIcons();
        return icons.map(serverIconToCustomSvg);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch custom SVGs from server:', error);
        return [];
    }
}

// Get a specific custom SVG by ID (localStorage fallback)
export function getCustomSvgById(userId: string, id: string): CustomSvg | undefined {
    const svgs = getCustomSvgs(userId);
    return svgs.find((svg) => svg.id === id);
}

// Get a specific custom SVG by ID from server
export async function getCustomSvgByIdFromServer(id: string): Promise<CustomSvg | undefined> {
    try {
        const icon = await Client4.getCustomChannelIcon(id);
        return serverIconToCustomSvg(icon);
    } catch {
        return undefined;
    }
}

// Get a custom SVG by name (for display purposes)
export function getCustomSvgByName(userId: string, name: string): CustomSvg | undefined {
    const svgs = getCustomSvgs(userId);
    return svgs.find((svg) => svg.name.toLowerCase() === name.toLowerCase());
}

// Save all custom SVGs for a user (localStorage fallback)
export function saveCustomSvgs(userId: string, svgs: CustomSvg[]): void {
    try {
        localStorage.setItem(getStorageKey(userId), JSON.stringify(svgs));
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to save custom SVGs:', error);
    }
}

// Add a new custom SVG (localStorage fallback)
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

// Add a new custom SVG to server
export async function addCustomSvgToServer(svg: Omit<CustomSvg, 'id' | 'createdAt'>): Promise<CustomSvg> {
    const icon = await Client4.createCustomChannelIcon({
        name: svg.name,
        svg: svg.svg,
        normalize_color: svg.normalizeColor,
    });
    return serverIconToCustomSvg(icon);
}

// Update an existing custom SVG (localStorage fallback)
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

// Update a custom SVG on server
export async function updateCustomSvgOnServer(id: string, updates: Partial<Omit<CustomSvg, 'id' | 'createdAt'>>): Promise<CustomSvg> {
    const icon = await Client4.updateCustomChannelIcon(id, {
        name: updates.name,
        svg: updates.svg,
        normalize_color: updates.normalizeColor,
    });
    return serverIconToCustomSvg(icon);
}

// Delete a custom SVG (localStorage fallback)
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

// Delete a custom SVG from server
export async function deleteCustomSvgFromServer(id: string): Promise<boolean> {
    try {
        await Client4.deleteCustomChannelIcon(id);
        return true;
    } catch {
        return false;
    }
}

// Migrate localStorage icons to server (admin only)
export async function migrateLocalStorageToServer(userId: string): Promise<{migrated: number; errors: number}> {
    const localSvgs = getCustomSvgs(userId);
    let migrated = 0;
    let errors = 0;

    // Get existing server icons to avoid duplicates
    let serverSvgs: CustomSvg[] = [];
    try {
        serverSvgs = await getCustomSvgsFromServer();
    } catch {
        // Continue with migration even if we can't fetch server icons
    }

    const serverNames = new Set(serverSvgs.map((svg) => svg.name.toLowerCase()));

    for (const localSvg of localSvgs) {
        // Skip if already exists on server (by name)
        if (serverNames.has(localSvg.name.toLowerCase())) {
            continue;
        }

        try {
            await addCustomSvgToServer({
                name: localSvg.name,
                svg: localSvg.svg,
                normalizeColor: localSvg.normalizeColor,
            });
            migrated++;
        } catch {
            errors++;
        }
    }

    // Clear localStorage after successful migration
    if (migrated > 0 && errors === 0) {
        try {
            localStorage.removeItem(getStorageKey(userId));
        } catch {
            // Ignore
        }
    }

    return {migrated, errors};
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

// Normalize SVG to have a standard 24x24 viewBox with content properly scaled and centered
export function normalizeSvgViewBox(content: string): string {
    // Target viewBox dimensions
    const TARGET_SIZE = 24;

    // Extract original viewBox
    let originalViewBox = extractSvgViewBox(content);

    // If no viewBox, try to create one from width/height or default to 24x24
    if (!originalViewBox) {
        originalViewBox = {x: 0, y: 0, width: TARGET_SIZE, height: TARGET_SIZE};
    }

    // If already 24x24 starting at 0,0, just ensure preserveAspectRatio is set
    if (originalViewBox.x === 0 && originalViewBox.y === 0 &&
        originalViewBox.width === TARGET_SIZE && originalViewBox.height === TARGET_SIZE) {
        // Just add preserveAspectRatio if not present
        if (!content.includes('preserveAspectRatio')) {
            content = content.replace(/<svg/, '<svg preserveAspectRatio="xMidYMid meet"');
        }
        return content;
    }

    // Calculate transform to center and scale content into 24x24
    const scale = Math.min(TARGET_SIZE / originalViewBox.width, TARGET_SIZE / originalViewBox.height);
    const scaledWidth = originalViewBox.width * scale;
    const scaledHeight = originalViewBox.height * scale;
    const translateX = (TARGET_SIZE - scaledWidth) / 2 - (originalViewBox.x * scale);
    const translateY = (TARGET_SIZE - scaledHeight) / 2 - (originalViewBox.y * scale);

    // Extract the inner content
    const innerMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (!innerMatch) {
        return content;
    }
    const innerContent = innerMatch[1];

    // Extract existing SVG attributes (excluding viewBox, width, height, preserveAspectRatio)
    const svgTagMatch = content.match(/<svg([^>]*)>/i);
    let existingAttrs = '';
    if (svgTagMatch) {
        existingAttrs = svgTagMatch[1]
            .replace(/viewBox\s*=\s*["'][^"']*["']/gi, '')
            .replace(/width\s*=\s*["'][^"']*["']/gi, '')
            .replace(/height\s*=\s*["'][^"']*["']/gi, '')
            .replace(/preserveAspectRatio\s*=\s*["'][^"']*["']/gi, '')
            .trim();
    }

    // Build the normalized SVG
    // Wrap content in a group with transform to scale and center it
    const transform = `translate(${translateX.toFixed(4)}, ${translateY.toFixed(4)}) scale(${scale.toFixed(4)})`;

    return `<svg viewBox="0 0 ${TARGET_SIZE} ${TARGET_SIZE}" preserveAspectRatio="xMidYMid meet"${existingAttrs ? ' ' + existingAttrs : ''}><g transform="${transform}">${innerContent}</g></svg>`;
}
