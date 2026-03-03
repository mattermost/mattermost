// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Heading {
    id: string;
    text: string;
    level: number; // 1, 2, 3
}

/**
 * Extracts headings (H1, H2, H3) from TipTap JSON or markdown content
 * @param content The content to parse (TipTap JSON string or markdown)
 * @returns Array of headings with id, text, and level
 */
export function extractHeadingsFromContent(content: string): Heading[] {
    if (!content || typeof content !== 'string') {
        return [];
    }

    // Try to parse as TipTap JSON first
    try {
        const doc = JSON.parse(content);

        if (doc.type === 'doc' && doc.content) {
            const headings = extractHeadingsFromTipTapJSON(doc);
            return headings;
        }
    } catch (e) {
        // Not JSON, fallback to markdown
    }

    // Fallback to markdown parsing
    const headings = extractHeadingsFromMarkdown(content);
    return headings;
}

/**
 * Extracts headings from TipTap JSON document
 * Reads the ID from node.attrs.id (which is set by the TipTap editor plugin)
 */
function extractHeadingsFromTipTapJSON(doc: any): Heading[] {
    const headings: Heading[] = [];

    function traverseNodes(nodes: any[]) {
        for (const node of nodes) {
            if (node.type === 'heading' && node.attrs?.level <= 3) {
                const text = extractTextFromNode(node);
                const id = node.attrs?.id;

                if (text && id) {
                    headings.push({
                        id,
                        text: text.trim(),
                        level: node.attrs.level,
                    });
                }
            }

            // Recursively traverse child nodes
            if (node.content) {
                traverseNodes(node.content);
            }
        }
    }

    if (doc.content) {
        traverseNodes(doc.content);
    }

    return headings;
}

/**
 * Extracts text content from a TipTap node
 */
function extractTextFromNode(node: any): string {
    if (node.type === 'text') {
        return node.text || '';
    }

    if (node.content) {
        return node.content.map(extractTextFromNode).join('');
    }

    return '';
}

/**
 * Extracts headings from markdown content
 */
function extractHeadingsFromMarkdown(markdownContent: string): Heading[] {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const headings: Heading[] = [];
    const usedSlugs = new Map<string, number>();
    let match;

    while ((match = headingRegex.exec(markdownContent)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();

        let slug = text.
            toLowerCase().
            trim().
            replace(/\s+/g, '-').
            replace(/[^\w-]+/g, '').
            replace(/--+/g, '-').
            replace(/^-+|-+$/g, '');

        if (usedSlugs.has(slug)) {
            const count = usedSlugs.get(slug)! + 1;
            usedSlugs.set(slug, count);
            slug = `${slug}-${count}`;
        } else {
            usedSlugs.set(slug, 1);
        }

        headings.push({id: slug, text: text.trim(), level});
    }

    return headings;
}

/**
 * Extracts headings from rendered DOM for a specific page
 * Fallback method when markdown content is not available
 * @param pageId The ID of the page to extract headings from
 * @returns Array of headings with id, text, and level
 */
export function extractHeadingsFromDOM(pageId: string): Heading[] {
    if (!pageId) {
        return [];
    }

    const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
    if (!pageElement) {
        return [];
    }

    const headingElements = pageElement.querySelectorAll('h1, h2, h3');

    return Array.from(headingElements).map((el, index) => ({
        id: el.id || `heading-${index}`,
        text: el.textContent?.trim() || '',
        level: parseInt(el.tagName.charAt(1), 10),
    }));
}

/**
 * Scrolls to a heading element by ID with smooth behavior
 * @param headingId The ID of the heading element to scroll to
 */
export function scrollToHeading(headingId: string): void {
    if (!headingId) {
        return;
    }

    const element = document.getElementById(headingId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });

        element.classList.add('highlighted');
        setTimeout(() => element.classList.remove('highlighted'), 2000);
    }
}
