// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import * as Utils from 'utils/utils';

const USERNAME_REGEX = /@([a-z0-9._-]*[a-z0-9])(?=[^a-z0-9]|$)/g;

/**
 * Generates a raw value from the input value by replacing usernames with their raw values.
 * @param rawValue - The raw value to process.
 * @param inputValue - The input value to process.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The generated raw value
 * @example
 * // rawValue: "Hello @john_doe"
 * // inputValue: "Hello @John Doe, How are you?"
 * // Output: "Hello @john_doe, How are you?"
 */
export const generateRawValueFromInputValue = (rawValue: string, inputValue: string, usersByUsername: Record<string, UserProfile> = {}, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME): string => {
    const mentionMappings = extractMentionRawMappings(rawValue);

    let result = inputValue;
    const replacedPositions = new Set<number>();

    for (const mapping of mentionMappings) {
        const user = usersByUsername[mapping.username];
        const displayName = displayUsername(user, teammateNameDisplay, false);
        const replacement = mapping.username;

        if (!user) {
            continue;
        }

        const mentionPattern = `@${displayName}`;
        const mentionIndex = result.indexOf(mentionPattern);

        if (mentionIndex !== -1) {
            const beforeMentionIndex = mentionIndex - 1;
            const afterMentionIndex = mentionIndex + mentionPattern.length;
            const charBeforeMention = result.charAt(beforeMentionIndex);
            const charAfterMention = result.charAt(afterMentionIndex);

            let beforeValid = mentionIndex === 0 || !(/[a-zA-Z0-9]/).test(charBeforeMention);
            if (!beforeValid) {
                const textBeforeMention = result.substring(0, mentionIndex);
                const mentionEndPattern = /@[a-zA-Z0-9._-]+$/;
                beforeValid = mentionEndPattern.test(textBeforeMention);
            }

            let afterValid = afterMentionIndex === result.length || !(/[a-zA-Z0-9]/).test(charAfterMention);
            if (!afterValid) {
                const textAfterMention = result.substring(afterMentionIndex);
                const mentionStartPattern = /^@[a-zA-Z0-9._-]+/;
                afterValid = mentionStartPattern.test(textAfterMention);
            }

            if (beforeValid && afterValid) {
                result = replaceFirstUnprocessed(result, displayName, replacement, replacedPositions);
            }
        }
    }

    return result;
};

/**
 * Generates a display value from the raw value by replacing usernames with their display names.
 * @param rawValue - The raw value to process.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The generated display value
 */
export const generateDisplayValueFromRawValue = (rawValue: string, usersByUsername: Record<string, UserProfile> = {}, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME): string => {
    const mentionMappings = extractMentionRawMappings(rawValue);
    const processedPositions = new Set<number>();

    let result = rawValue;
    for (const mapping of mentionMappings) {
        const user = usersByUsername[mapping.username];
        if (!user) {
            continue;
        }
        const displayName = displayUsername(user, teammateNameDisplay, false);
        result = replaceFirstUnprocessed(result, mapping.fullMatch, `@${displayName}`, processedPositions);
    }
    return result;
};

/**
 * Converts a display position to a raw position.
 * @param displayPosition - The position in the display value.
 * @param rawValue - The raw value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The corresponding position in the raw value.
 */
export const convertDisplayPositionToRawPosition = (
    displayPosition: number,
    rawValue: string,
    usersByUsername?: Record<string, UserProfile>,
    teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME,
): number => {
    if (!usersByUsername || displayPosition <= 0) {
        return displayPosition;
    }

    const mentions = buildMentionMappings(rawValue, usersByUsername, teammateNameDisplay);

    let rawPosition = displayPosition;

    for (const mention of mentions) {
        if (displayPosition <= mention.displayStart) {
            break;
        } else if (displayPosition <= mention.displayEnd) {
            rawPosition = mention.rawEnd;
            break;
        } else {
            const lengthDiff = mention.rawEnd - mention.rawStart - (mention.displayEnd - mention.displayStart);
            rawPosition += lengthDiff;
        }
    }

    return Math.max(0, Math.min(rawPosition, rawValue.length));
};

/**
 * Converts a raw position to a display position.
 * @param rawPosition - The position in the raw value.
 * @param rawValue - The raw value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The corresponding position in the display value.
 */
export const convertRawPositionToDisplayPosition = (
    rawPosition: number,
    rawValue: string,
    usersByUsername?: Record<string, UserProfile>,
    teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME,
): number => {
    if (!usersByUsername || rawPosition <= 0) {
        return rawPosition;
    }

    const displayValue = generateDisplayValueFromRawValue(rawValue, usersByUsername, teammateNameDisplay);
    const mentions = buildMentionMappings(rawValue, usersByUsername, teammateNameDisplay);

    let displayPosition = rawPosition;
    let accumulatedLengthDiff = 0;

    for (const mention of mentions) {
        if (rawPosition <= mention.rawStart) {
            displayPosition = rawPosition + accumulatedLengthDiff;
            break;
        } else if (rawPosition <= mention.rawEnd) {
            displayPosition = mention.displayEnd;
            break;
        } else {
            const lengthDiff = mention.displayEnd - mention.displayStart - (mention.rawEnd - mention.rawStart);
            accumulatedLengthDiff += lengthDiff;
        }
    }

    if (mentions.length > 0 && rawPosition > mentions[mentions.length - 1].rawEnd) {
        displayPosition = rawPosition + accumulatedLengthDiff;
    }

    return Math.max(0, Math.min(displayPosition, displayValue.length));
};

/**
 * Updates the component state when a mention suggestion is selected.
 * @param item - The selected suggestion item.
 * @param inputValue - The current input value.
 * @param rawValue - The raw value of the input.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @param setState - The state updater function.
 * @param textBox - The text box element.
 */
export const updateStateWhenSuggestionSelected = (
    item: any,
    inputValue: string,
    rawValue: string,
    usersByUsername: Record<string, UserProfile> | undefined,
    teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME,
    setState: (state: any, callback?: () => void) => void,
    textBox?: HTMLInputElement | HTMLTextAreaElement | null,
) => {
    if (!usersByUsername) {
        return;
    }
    if (item && item.username && item.type !== 'mention_groups') {
        const newRawValue = generateRawValueFromInputValue(rawValue, inputValue, usersByUsername, teammateNameDisplay);
        const newDisplayValue = generateDisplayValueFromRawValue(newRawValue, usersByUsername, teammateNameDisplay);

        if (textBox && textBox.value !== newDisplayValue) {
            textBox.value = newDisplayValue;
        }

        const cursorPosition = calculateCursorPositionAfterMention(
            inputValue,
            item.username,
            displayUsername(item, teammateNameDisplay, false),
        );

        setState({
            rawValue: newRawValue,
            displayValue: newDisplayValue,
        }, () => {
            window.requestAnimationFrame(() => {
                if (textBox) {
                    Utils.setCaretPosition(textBox, cursorPosition);
                }
            });
        });
    }
};

/**
 * Updates the component state when the input value changes.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @param setState - The state updater function.
 * @param e - The change event.
 * @param onChange - The change handler.
 * @returns
 */
export const updateStateWhenOnChanged = (rawValue: string, usersByUsername: Record<string, UserProfile> | undefined, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME, setState: (state: any) => void, e: React.ChangeEvent<HTMLInputElement>, onChange: (event: React.ChangeEvent<HTMLInputElement>) => void) => {
    const inputValue = e.target.value;

    if (!usersByUsername) {
        return;
    }

    const newRawValue = generateRawValueFromInputValue(rawValue, inputValue, usersByUsername, teammateNameDisplay);
    const newDisplayValue = generateDisplayValueFromRawValue(newRawValue, usersByUsername, teammateNameDisplay);
    const newMentionHighlights = calculateMentionPositions(newRawValue, newDisplayValue, usersByUsername, teammateNameDisplay);

    setState({
        rawValue: newRawValue,
        displayValue: newDisplayValue,
        mentionHighlights: newMentionHighlights,
    });

    const syntheticEvent = {
        ...e,
        target: {
            ...e.target,
            value: newRawValue,
        },
    } as React.ChangeEvent<HTMLInputElement>;

    onChange(syntheticEvent);
};

/**
 * Updates the component state when the input value changes.
 * @param prevProps - The previous props.
 * @param setState - The state updater function.
 * @param currentChannelId - The current channel ID.
 * @param value - The current input value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 */
export const resetState = (prevProps: any, setState: (state: any) => void, value: string, rawValue: string, usersByUsername: Record<string, UserProfile> | undefined, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME) => {
    if (!usersByUsername) {
        return;
    }

    if (prevProps.value !== value && rawValue !== value) {
        const displayValue = generateDisplayValueFromRawValue(value, usersByUsername, teammateNameDisplay);

        setState({
            displayValue,
            rawValue: value,
            mentionHighlights: calculateMentionPositions(value, displayValue, usersByUsername, teammateNameDisplay),
        });
    }
};

/**
 * Calculates the positions of mentions in the display value based on the raw value.
 * @param rawValue - The current raw value.
 * @param displayValue - The current display value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns An array of objects representing the start and end positions of each mention.
 */
export const calculateMentionPositions = (
    rawValue: string,
    displayValue: string,
    usersByUsername: Record<string, UserProfile> = {},
    teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME,
): Array<{start: number; end: number; username: string}> => {
    const positions: Array<{start: number; end: number; username: string}> = [];
    const mentionMappings = extractMentionRawMappings(rawValue);

    let rawCursor = 0;
    let displayCursor = 0;

    for (const mapping of mentionMappings) {
        const user = usersByUsername[mapping.username];
        if (!user) {
            const rawMentionStart = rawValue.indexOf(mapping.fullMatch, rawCursor);
            if (rawMentionStart !== -1) {
                const beforeMentionRaw = rawValue.slice(rawCursor, rawMentionStart);
                displayCursor += beforeMentionRaw.length + mapping.fullMatch.length;
                rawCursor = rawMentionStart + mapping.fullMatch.length;
            }
            continue;
        }

        const rawMentionStart = rawValue.indexOf(mapping.fullMatch, rawCursor);
        if (rawMentionStart === -1) {
            continue;
        }

        const beforeMentionRaw = rawValue.slice(rawCursor, rawMentionStart);
        displayCursor += beforeMentionRaw.length;

        const displayName = displayUsername(user, teammateNameDisplay, false);
        const displayMentionPattern = `@${displayName}`;

        const displayMentionStart = displayValue.indexOf(displayMentionPattern, displayCursor);

        if (displayMentionStart === -1) {
            displayCursor += mapping.fullMatch.length;
        } else {
            positions.push({
                start: displayMentionStart,
                end: displayMentionStart + displayMentionPattern.length,
                username: mapping.username,
            });

            displayCursor = displayMentionStart + displayMentionPattern.length;
        }

        rawCursor = rawMentionStart + mapping.fullMatch.length;
    }

    return positions;
};

/**
 * Extracts raw mention mappings from the input value.
 * @param rawValue - The current raw value.
 * @returns An array of objects representing the full match and username for each mention.
 */
const extractMentionRawMappings = (rawValue: string): Array<{ fullMatch: string; username: string }> => {
    const mappings: Array<{ fullMatch: string; username: string }> = [];
    const regex = new RegExp(USERNAME_REGEX.source, 'g');
    let match;

    while ((match = regex.exec(rawValue)) !== null) {
        mappings.push({
            fullMatch: match[0],
            username: match[1],
        });
    }

    return mappings;
};

/**
 * Builds mention position mappings between raw and display values.
 * @param rawValue - The raw value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns An array of mention mappings with raw and display positions.
 */
const buildMentionMappings = (
    rawValue: string,
    usersByUsername: Record<string, UserProfile>,
    teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME,
): Array<{
    username: string;
    displayName: string;
    rawStart: number;
    rawEnd: number;
    displayStart: number;
    displayEnd: number;
}> => {
    const mentionMappings = extractMentionRawMappings(rawValue);
    const mentions: Array<{
        username: string;
        displayName: string;
        rawStart: number;
        rawEnd: number;
        displayStart: number;
        displayEnd: number;
    }> = [];

    let rawCursor = 0;
    let displayCursor = 0;

    for (const mapping of mentionMappings) {
        const user = usersByUsername[mapping.username];
        if (!user) {
            const rawMentionStart = rawValue.indexOf(mapping.fullMatch, rawCursor);
            if (rawMentionStart !== -1) {
                const beforeMentionRaw = rawValue.slice(rawCursor, rawMentionStart);
                displayCursor += beforeMentionRaw.length + mapping.fullMatch.length;
                rawCursor = rawMentionStart + mapping.fullMatch.length;
            }
            continue;
        }

        const rawMentionStart = rawValue.indexOf(mapping.fullMatch, rawCursor);
        if (rawMentionStart === -1) {
            continue;
        }

        const beforeMentionRaw = rawValue.slice(rawCursor, rawMentionStart);
        displayCursor += beforeMentionRaw.length;

        const rawStart = rawMentionStart;
        const rawEnd = rawStart + mapping.fullMatch.length;
        const displayStart = displayCursor;

        const displayName = displayUsername(user, teammateNameDisplay, false);
        const displayMentionLength = `@${displayName}`.length;
        const displayEnd = displayStart + displayMentionLength;

        mentions.push({
            username: mapping.username,
            displayName,
            rawStart,
            rawEnd,
            displayStart,
            displayEnd,
        });

        rawCursor = rawEnd;
        displayCursor = displayEnd;
    }

    return mentions;
};

/**
 * Replaces the first unprocessed occurrence of a pattern in the text with a replacement string.
 * @param text - The original text.
 * @param pattern - The pattern to replace.
 * @param replacement - The replacement string.
 * @param processedPositions - A set of positions that have already been processed.
 * @returns The updated text with the replacement applied.
 */
const replaceFirstUnprocessed = (
    text: string,
    pattern: string,
    replacement: string,
    processedPositions: Set<number>,
): string => {
    let searchIndex = 0;
    let foundIndex = -1;

    while ((foundIndex = text.indexOf(pattern, searchIndex)) !== -1) {
        if (!processedPositions.has(foundIndex)) {
            const result = text.slice(0, foundIndex) + replacement + text.slice(foundIndex + pattern.length);

            for (let i = foundIndex; i < foundIndex + replacement.length; i++) {
                processedPositions.add(i);
            }

            return result;
        }
        searchIndex = foundIndex + 1;
    }

    return text;
};

/**
 * Calculates the cursor position after a mention is inserted.
 * @param textValue - The current text value.
 * @param username - The username of the mentioned user.
 * @param displayName - The display name of the mentioned user.
 * @returns The new cursor position.
 */
const calculateCursorPositionAfterMention = (
    textValue: string,
    username: string,
    displayName: string,
): number => {
    const usernameIndex = textValue.indexOf(username);
    if (usernameIndex === -1) {
        return textValue.length;
    }

    const basePosition = usernameIndex + username.length + 1;

    const lengthDifference = displayName.length - username.length;

    return basePosition + lengthDifference;
};
