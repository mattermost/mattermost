// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import * as Utils from 'utils/utils';

const MENTION_REGEX = /@([a-zA-Z0-9.\-_]+)<x-name>@([^<]+)<\/x-name>/g;
const USERNAME_REGEX = /@([a-zA-Z0-9.\-_]+)/g;

/**
 * Generates a map value from the input value by replacing usernames with their map values.
 * @param inputValue - The input value to process.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The generated map value
 * @example
 * // inputValue: "Hello @john_doe"
 * // retrun: "Hello @john_doe<x-name>@John Doe</x-name>"
 */
export const generateMapValueFromInputValue = (inputValue: string, usersByUsername: Record<string, UserProfile> | undefined, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME): string => {
    if (!usersByUsername) {
        return inputValue;
    }
    return inputValue.replace(USERNAME_REGEX, (match, username) => {
        const user = usersByUsername[username];
        if (user) {
            const displayUserName = displayUsername(user, teammateNameDisplay, false);
            return `@${username}<x-name>@${displayUserName}</x-name>`;
        }
        return match;
    });
};

/**
 * Generates a display value from the map value by replacing mention tags with their display names.
 * @param mapValue - The map value to process.
 * @returns The generated display value
 * @example
 * // mapValue: "Hello @john_doe<x-name>@John Doe</x-name>"
 * // return: "Hello @John Doe"
 */
export const generateDisplayValueFromMapValue = (mapValue: string): string => {
    return mapValue.replace(new RegExp(MENTION_REGEX.source, 'g'), (_, username, displayName) => {
        return `@${displayName}`;
    });
};

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

        result = replaceFirstUnprocessed(result, displayName, replacement, replacedPositions);
    }

    return result;
};

/**
 * Generates a map value from the raw input value.
 * @param rawValue - The raw input value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The generated map value.
 * @example
 * // rawValue: "Hello @john_doe"
 * // return: "Hello @john_doe<x-name>@John Doe</x-name>"
 */
export const generateMapValueFromRawValue = (rawValue: string, usersByUsername: Record<string, UserProfile> = {}, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME): string => {
    const mentionMappings = extractMentionRawMappings(rawValue);

    let result = rawValue;
    const replacedPositions = new Set<number>();

    for (const mapping of mentionMappings) {
        const user = usersByUsername[mapping.username];
        const displayName = displayUsername(user, teammateNameDisplay, false);
        result = replaceFirstUnprocessed(result, mapping.fullMatch, `@${mapping.username}<x-name>@${displayName}</x-name>`, replacedPositions);
    }
    return result;
};

/**
 * Generates a raw value from the map value by replacing mention tags with their raw usernames.
 * @param mapValue - The map value to process.
 * @param inputValue - The input value to process.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @returns The generated raw value
 * @example
 * // mapValue: "Hello @john_doe<x-name>@John Doe</x-name>"
 * // inputValue: "Hello @John Doe, How are you?"
 * // return: "Hello @john_doe, How are you?"
 */
export const generateRawValueFromMapValue = (mapValue: string, inputValue: string, usersByUsername: Record<string, UserProfile> = {}, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME): string => {
    const mentionMappings = extractMentionMapMappings(mapValue);

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
            const beforeValid = mentionIndex === 0 || (/[\s\n\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/).test(charBeforeMention);
            const afterValid = afterMentionIndex === result.length || (/[\s\n\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/).test(charAfterMention);

            if (beforeValid && afterValid) {
                result = replaceFirstUnprocessed(result, displayName, replacement, replacedPositions);
            }
        }
    }

    return result;
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
        const newMapValue = generateMapValueFromRawValue(newRawValue, usersByUsername, teammateNameDisplay);
        const newDisplayValue = generateDisplayValueFromMapValue(newMapValue);

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
            mapValue: newMapValue,
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
 * @param mapValue - The current map value.
 * @param usersByUsername - A mapping of usernames to user profiles.
 * @param teammateNameDisplay - The display setting for teammate names.
 * @param setState - The state updater function.
 * @param e - The change event.
 * @param onChange - The change handler.
 * @returns
 */
export const updateStateWhenOnChanged = (mapValue: string, usersByUsername: Record<string, UserProfile> | undefined, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME, setState: (state: any) => void, e: React.ChangeEvent<HTMLInputElement>, onChange: (event: React.ChangeEvent<HTMLInputElement>) => void) => {
    const inputValue = e.target.value;

    if (!usersByUsername) {
        return;
    }

    const newRawValue = generateRawValueFromMapValue(mapValue, inputValue, usersByUsername, teammateNameDisplay);
    const newMapValue = generateMapValueFromRawValue(newRawValue, usersByUsername, teammateNameDisplay);
    const newDisplayValue = generateDisplayValueFromMapValue(newMapValue);
    const newMentionHighlights = calculateMentionPositions(newMapValue, newDisplayValue);

    setState({
        mapValue: newMapValue,
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
        const mapValue = generateMapValueFromInputValue(value, usersByUsername, teammateNameDisplay);
        const displayValue = generateDisplayValueFromMapValue(mapValue);

        setState({
            mapValue,
            displayValue,
            rawValue: value,
            mentionHighlights: calculateMentionPositions(mapValue, displayValue),
        });
    }
};

/**
 * Calculates the positions of mentions in the display value based on the map value.
 * @param mapValue - The current map value.
 * @param displayValue - The current display value.
 * @returns An array of objects representing the start and end positions of each mention.
 */
export const calculateMentionPositions = (mapValue: string, displayValue: string): Array<{start: number; end: number; username: string}> => {
    const positions: Array<{start: number; end: number; username: string}> = [];
    const mapMentionRegex = /@([a-zA-Z0-9.\-_]+)<x-name>@([^<]+)<\/x-name>/g;
    let mapMatch;

    while ((mapMatch = mapMentionRegex.exec(mapValue)) !== null) {
        const username = mapMatch[1];
        const displayName = mapMatch[2];

        const displayMentionPattern = `@${displayName}`;
        let searchStartIndex = 0;
        let displayIndex = displayValue.indexOf(displayMentionPattern, searchStartIndex);

        while (displayIndex !== -1) {
            const currentDisplayIndex = displayIndex;
            const isAlreadyProcessed = positions.some((pos) =>
                currentDisplayIndex >= pos.start && currentDisplayIndex < pos.end,
            );

            if (!isAlreadyProcessed) {
                positions.push({
                    start: displayIndex,
                    end: displayIndex + displayMentionPattern.length,
                    username,
                });
                break;
            }

            searchStartIndex = displayIndex + 1;
            displayIndex = displayValue.indexOf(displayMentionPattern, searchStartIndex);
        }
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
 * Extracts mention mappings from the map value.
 * @param mapValue - The current map value.
 * @returns An array of objects representing the full match and username for each mention.
 */
const extractMentionMapMappings = (mapValue: string): Array<{ fullMatch: string; username: string }> => {
    const mappings: Array<{ fullMatch: string; username: string }> = [];
    const regex = /@([a-zA-Z0-9.\-_]+)<x-name>.*?<\/x-name>/g;
    let match;

    while ((match = regex.exec(mapValue)) !== null) {
        mappings.push({
            fullMatch: match[0],
            username: match[1],
        });
    }

    return mappings;
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
