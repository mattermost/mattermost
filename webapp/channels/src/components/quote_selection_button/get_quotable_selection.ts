// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const MESSAGE_TEXT_SELECTOR = '.post-message__text';
const CENTER_POST_ID_PREFIX = 'post_';
const RHS_POST_ID_PREFIX = 'rhsPost_';
const POST_ID_PATTERN = /^[a-z0-9]{26}$/;

export type QuotableSelection = {
    postId: string;
    isRHS: boolean;
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

function getCaretRect(node: Node, offset: number): DOMRect | null {
    const caret = document.createRange();
    caret.setStart(node, offset);
    caret.collapse(true);

    const rect = caret.getBoundingClientRect();
    return rect.height ? rect : null;
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

function isSelectionBackward(selection: Selection) {
    if (selection.anchorNode === selection.focusNode) {
        return selection.focusOffset < selection.anchorOffset;
    }

    const position = selection.anchorNode!.compareDocumentPosition(selection.focusNode!);
    return Boolean(position & Node.DOCUMENT_POSITION_PRECEDING);
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
    const text = selection.toString();
    if (!text.trim()) {
        return null;
    }

    const isRHS = postElement.id.startsWith(RHS_POST_ID_PREFIX);
    const postId = postElement.id.slice((isRHS ? RHS_POST_ID_PREFIX : CENTER_POST_ID_PREFIX).length);
    if (!POST_ID_PATTERN.test(postId)) {
        return null;
    }

    let focusRect = isBackward ? getCaretRect(quotedRange.startContainer, quotedRange.startOffset) : getCaretRect(quotedRange.endContainer, quotedRange.endOffset);
    if (!focusRect) {
        // Fall back to the first or last line of the selection when the caret position can't be measured.
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
