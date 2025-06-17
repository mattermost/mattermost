// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface MentionRange {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

export interface CursorPositionInfo {
    readonly inArea: boolean;
    readonly range?: MentionRange;
    readonly position?: number;
}

export interface MentionDeletionResult {
    readonly shouldDelete: boolean;
    readonly newPosition?: number;
    readonly newText?: string;
}

export interface MentionInvasionResult {
    readonly willInvade: boolean;
    readonly safePosition?: number;
}

// Cached regular expression for mention detection (performance optimization)
const MENTION_REGEX = /@([a-z0-9.\-_]+)/gi;

/**
 * Detects and returns mention ranges in text
 * @param text - The text to search for mentions
 * @returns Array of mention ranges
 */
export function getMentionRanges(text: string): MentionRange[] {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const ranges: MentionRange[] = [];
    // Reset regex lastIndex to ensure proper execution
    MENTION_REGEX.lastIndex = 0;
    let match;

    while ((match = MENTION_REGEX.exec(text)) !== null) {
        ranges.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
        });
    }

    return ranges;
}

/**
 * Checks if cursor position is within a mention area
 * @param text - The text to check
 * @param cursorPosition - Current cursor position
 * @returns Detailed cursor position information
 */
export function getCursorPositionInfo(text: string, cursorPosition: number): CursorPositionInfo {
    if (!text || typeof text !== 'string' || cursorPosition < 0) {
        return { inArea: false };
    }

    const mentionRanges = getMentionRanges(text);

    for (const range of mentionRanges) {
        // Check if cursor is within mention area (inclusive start, exclusive end)
        if (cursorPosition >= range.start && cursorPosition < range.end) {
            return {
                inArea: true,
                range,
                position: cursorPosition,
            };
        }
    }

    return { inArea: false };
}

/**
 * Calculates safe cursor position avoiding mention areas
 * @param text - Target text
 * @param targetPosition - Target cursor position
 * @returns Safe cursor position
 */
export function getSafeCursorPosition(text: string, targetPosition: number): number {
    if (!text || typeof text !== 'string' || targetPosition < 0) {
        return 0;
    }

    const mentionRanges = getMentionRanges(text);
    let newPosition = targetPosition;

    for (const range of mentionRanges) {
        // If targetPosition is within mention area, move to end of mention
        if (targetPosition >= range.start && targetPosition < range.end) {
            newPosition = range.end;
            break;
        }
    }

    // Ensure cursor position doesn't exceed text length
    return Math.max(0, Math.min(newPosition, text.length));
}

/**
 * Checks if key input will invade mention areas
 * @param text - Target text
 * @param currentPosition - Current cursor position
 * @param key - Pressed key
 * @param ctrlKey - Whether Ctrl key is pressed
 * @param metaKey - Whether Meta key (Cmd) is pressed
 * @returns Invasion result and safe position
 */
export function willInvadeMentionArea(
    text: string,
    currentPosition: number,
    key: string,
    ctrlKey = false,
    metaKey = false
): MentionInvasionResult {
    if (!text || typeof text !== 'string' || currentPosition < 0) {
        return { willInvade: false };
    }

    const mentionRanges = getMentionRanges(text);

    // If no mentions found, allow normal processing
    if (mentionRanges.length === 0) {
        return { willInvade: false };
    }

    // Handle Home/Ctrl+Left/Cmd+Left navigation
    if ((key === 'Home') || (key === 'ArrowLeft' && (ctrlKey || metaKey))) {
        const targetPosition = 0;
        for (const range of mentionRanges) {
            if (targetPosition < range.end) {
                return { willInvade: true, safePosition: range.end };
            }
        }
        return { willInvade: false };
    }

    // Handle regular arrow key navigation
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPosition = key === 'ArrowLeft' ? currentPosition - 1 : currentPosition + 1;
        
        for (const range of mentionRanges) {
            // Right arrow invading mention start position
            if (key === 'ArrowRight' && currentPosition < range.start && nextPosition >= range.start) {
                return { willInvade: true, safePosition: range.start };
            }
            // Left arrow invading mention area
            if (key === 'ArrowLeft') {
                if (currentPosition > range.end && nextPosition < range.end && nextPosition >= range.start) {
                    return { willInvade: true, safePosition: range.end };
                }
                if (currentPosition === range.end && nextPosition === range.end - 1) {
                    return { willInvade: true, safePosition: range.end };
                }
            }
        }
    }

    return { willInvade: false };
}

/**
 * Handles mention deletion logic
 * @param text - Target text
 * @param cursorPosition - Current cursor position
 * @param key - Delete key ('Backspace' | 'Delete')
 * @returns Deletion processing result
 */
export function handleMentionDeletion(
    text: string,
    cursorPosition: number,
    key: 'Backspace' | 'Delete'
): MentionDeletionResult {
    if (!text || typeof text !== 'string' || cursorPosition < 0) {
        return { shouldDelete: false };
    }

    const mentionRanges = getMentionRanges(text);

    for (const range of mentionRanges) {
        if (key === 'Backspace' && cursorPosition === range.end) {
            // Backspace right after mention → delete entire mention
            const newText = text.substring(0, range.start) + text.substring(range.end);
            return {
                shouldDelete: true,
                newPosition: range.start,
                newText,
            };
        }

        if (key === 'Delete' && cursorPosition >= range.start && cursorPosition < range.end) {
            // Delete within mention → move to mention end
            return {
                shouldDelete: false,
                newPosition: range.end,
            };
        }
    }

    return { shouldDelete: false };
}

/**
 * Mention control keydown handler for SuggestionBox
 * High-level helper function including DOM operations
 */
export function handleMentionKeyDown(
    e: KeyboardEvent,
    value: string,
    textbox: HTMLInputElement | HTMLTextAreaElement | null,
    onChange: (event: any) => void
): boolean {
    if (!textbox || !value) {
        return false;
    }

    const currentPosition = textbox.selectionStart || 0;

    // Handle deletion keys
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const deletionResult = handleMentionDeletion(
            value,
            currentPosition,
            e.key as 'Backspace' | 'Delete'
        );

        if (deletionResult.shouldDelete && deletionResult.newText !== undefined) {
            e.preventDefault();
            updateTextboxValue(textbox, deletionResult.newText, deletionResult.newPosition || 0, onChange);
            return true;
        }

        if (deletionResult.newPosition !== undefined) {
            e.preventDefault();
            textbox.setSelectionRange(deletionResult.newPosition, deletionResult.newPosition);
            return true;
        }
    }

    // Handle navigation keys
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        const invasionResult = willInvadeMentionArea(
            value,
            currentPosition,
            e.key,
            e.ctrlKey,
            e.metaKey
        );

        if (invasionResult.willInvade && invasionResult.safePosition !== undefined) {
            e.preventDefault();
            textbox.setSelectionRange(invasionResult.safePosition, invasionResult.safePosition);
            return true;
        }
    }

    return false;
}

/**
 * Mention control mouse up handler for SuggestionBox
 */
export function handleMentionMouseUp(
    value: string,
    textbox: HTMLInputElement | HTMLTextAreaElement | null
): void {
    if (!textbox || !value) {
        return;
    }

    // Validate cursor position after mouse click
    setTimeout(() => {
        const currentPosition = textbox.selectionStart || 0;
        const positionInfo = getCursorPositionInfo(value, currentPosition);

        if (positionInfo.inArea && positionInfo.range) {
            const safePosition = getSafeCursorPosition(value, currentPosition);
            textbox.setSelectionRange(safePosition, safePosition);
        }
    }, 0);
}

/**
 * Helper to update textbox value and cursor position
 */
function updateTextboxValue(
    textbox: HTMLInputElement | HTMLTextAreaElement,
    value: string,
    cursorPosition: number,
    onChange: (event: any) => void
): void {
    textbox.value = value;
    textbox.setSelectionRange(cursorPosition, cursorPosition);
    
    // Update React state
    onChange({
        target: textbox,
        currentTarget: textbox,
    });
}
