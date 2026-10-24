// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import turndownService from 'utils/turndown';

const MESSAGE_TEXT_SELECTOR = '.post-message__text';
const CENTER_POST_ID_PREFIX = 'post_';
const RHS_POST_ID_PREFIX = 'rhsPost_';
const POST_ID_PATTERN = /^[a-z0-9]{26}$/;

export type QuotableSelection = {
    postId: string;
    isRHS: boolean;

    // Markdown of the selected part of the message
    text: string;

    // Where the user finished the selection, used to position the quote button next to it.
    focusRect: {x: number; y: number; height: number};
    isBackward: boolean;
};

function getElement(node: Node | null): Element | null {
    if (!node) {
        return null;
    }
    return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
}

function getPostElement(element: Element | null): Element | null {
    return element?.closest(`[id^="${CENTER_POST_ID_PREFIX}"], [id^="${RHS_POST_ID_PREFIX}"]`) ?? null;
}

function getSelectedTextNodes(range: Range): Text[] {
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
        return [root as Text];
    }

    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (range.intersectsNode(node)) {
            nodes.push(node as Text);
        }
    }
    return nodes;
}

/**
 * Returns the rect of the first (or, with `fromEnd`, the last) selected non-whitespace character.
 * A collapsed caret can't be used for this: at the start of a wrapped line, the same position is
 * also the end of the previous line, and browsers report it there.
 */
function getEdgeCharacterRect(range: Range, fromEnd: boolean): DOMRect | null {
    const nodes = getSelectedTextNodes(range);
    if (fromEnd) {
        nodes.reverse();
    }

    for (const node of nodes) {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.length;
        const text = node.data;

        for (let i = fromEnd ? end - 1 : start; fromEnd ? i >= start : i < end; i += fromEnd ? -1 : 1) {
            if (!(/\s/).test(text[i])) {
                const character = document.createRange();
                character.setStart(node, i);
                character.setEnd(node, i + 1);
                const rect = character.getBoundingClientRect();
                if (rect.height) {
                    return rect;
                }
            }
        }
    }

    return null;
}

// Whether the range includes text from outside of the given element. A triple click on the last
// line of a post, for example, ends the selection at the very start of the next post without
// selecting any of its text.
function selectsTextOutsideOf(range: Range, element: Element) {
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (element.contains(node) || !range.intersectsNode(node)) {
            continue;
        }

        let text = node.textContent ?? '';
        if (node === range.endContainer) {
            text = text.slice(0, range.endOffset);
        }
        if (node === range.startContainer) {
            text = text.slice(range.startOffset);
        }
        if (text.trim()) {
            return true;
        }
    }

    return false;
}

/**
 * Returns the selected part of the message as HTML. A selection inside formatted content, like part
 * of a list item or a code block, is wrapped in shallow copies of its ancestors up to the message so
 * that the formatting it's in is kept.
 */
function getSelectedHtml(range: Range, messageElement: Element): HTMLElement {
    let content: Node = range.cloneContents();
    for (let element = getElement(range.commonAncestorContainer); element && element !== messageElement && messageElement.contains(element); element = element.parentElement) {
        const wrapper = element.cloneNode(false);
        wrapper.appendChild(content);

        // The language of a code block is read from its label, which isn't part of a selection inside the code
        const languageLabel = element.classList.contains('post-code') ? element.querySelector('.post-code__language') : null;
        if (languageLabel && !(wrapper as Element).querySelector('.post-code__language')) {
            wrapper.appendChild(languageLabel.cloneNode(true));
        }

        content = wrapper;
    }

    const container = document.createElement('div');
    container.appendChild(content);
    return container;
}

function isSelectionBackward(selection: Selection) {
    const range = document.createRange();
    range.setStart(selection.anchorNode!, selection.anchorOffset);
    range.setEnd(selection.focusNode!, selection.focusOffset);

    // Setting the end of a range before its start collapses the range onto the end.
    return range.collapsed;
}

/**
 * Returns what can be quoted from the current text selection, or null when the selection
 * isn't text from the message of a single post in the center channel, RHS or Threads view.
 *
 * Selections that start in a post's message and spill over the rest of the post without
 * selecting text of another post (such as after a triple click) are trimmed to the message text.
 */
export function getQuotableSelection(selection: Selection | null): QuotableSelection | null {
    if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.anchorNode || !selection.focusNode) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const startElement = getElement(range.startContainer);
    const endElement = getElement(range.endContainer);

    const startMessage = startElement?.closest(MESSAGE_TEXT_SELECTOR);
    const endMessage = endElement?.closest(MESSAGE_TEXT_SELECTOR);
    const messageElement = startMessage ?? endMessage;
    if (!messageElement) {
        return null;
    }

    const postElement = getPostElement(messageElement);
    if (!postElement || selectsTextOutsideOf(range, postElement)) {
        return null;
    }

    const isBackward = isSelectionBackward(selection);

    const quotedRange = range.cloneRange();
    if (startMessage !== messageElement || endMessage !== messageElement) {
        if (startMessage !== messageElement) {
            quotedRange.setStart(messageElement, 0);
        }
        if (endMessage !== messageElement) {
            quotedRange.setEnd(messageElement, messageElement.childNodes.length);
        }

        // Narrow the selection down to what will be quoted so the user can see it.
        if (isBackward) {
            selection.setBaseAndExtent(quotedRange.endContainer, quotedRange.endOffset, quotedRange.startContainer, quotedRange.startOffset);
        } else {
            selection.setBaseAndExtent(quotedRange.startContainer, quotedRange.startOffset, quotedRange.endContainer, quotedRange.endOffset);
        }
    }

    // Unlike Range.toString, Selection.toString keeps line breaks between paragraphs.
    const plainText = selection.toString();
    if (!plainText.trim()) {
        return null;
    }
    const text = turndownService.turndown(getSelectedHtml(quotedRange, messageElement)).trim() || plainText;

    const isRHS = postElement.id.startsWith(RHS_POST_ID_PREFIX);
    const postId = postElement.id.slice((isRHS ? RHS_POST_ID_PREFIX : CENTER_POST_ID_PREFIX).length);
    if (!POST_ID_PATTERN.test(postId)) {
        return null;
    }

    // The button goes next to where the selection ended: before its first character when selecting
    // backwards and after its last character otherwise.
    const edge = getEdgeCharacterRect(quotedRange, !isBackward);
    let focusRect = edge && new DOMRect(isBackward ? edge.left : edge.right, edge.top, 0, edge.height);
    if (!focusRect) {
        // Fall back to the first or last line of the selection when no character can be measured.
        const rects = Array.from(quotedRange.getClientRects()).filter((rect) => rect.height > 0);
        if (!rects.length) {
            return null;
        }
        const line = isBackward ? rects[0] : rects[rects.length - 1];
        focusRect = new DOMRect(isBackward ? line.left : line.right, line.top, 0, line.height);
    }

    return {
        postId,
        isRHS,
        text,
        focusRect: {
            x: focusRect.left,
            y: focusRect.top,
            height: focusRect.height,
        },
        isBackward,
    };
}
