// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Pre-compiled messages for Vitest tests.
 *
 * This module compiles i18n messages to AST format at import time,
 * which eliminates the "@formatjs/intl" warning about pre-compilation
 * when using defaultRichTextElements.
 *
 * Uses @formatjs/icu-messageformat-parser which is already installed
 * as a dependency of react-intl.
 */

import {parse} from '@formatjs/icu-messageformat-parser';
import type {MessageFormatElement} from '@formatjs/icu-messageformat-parser';

import defaultMessages from 'i18n/en.json';

export type CompiledMessages = Record<string, MessageFormatElement[]>;

/**
 * Compiles all messages from string format to AST format.
 * This is done once at module load time.
 * Exported for use in tests that need to compile custom messages.
 */
export function compileMessages(messages: Record<string, string>): CompiledMessages {
    const compiled: CompiledMessages = {};

    for (const [key, value] of Object.entries(messages)) {
        try {
            compiled[key] = parse(value, {
                ignoreTag: false, // Parse rich text tags like <b>, <strong>
            });
        } catch {
            // If parsing fails, skip this message (it will use the string fallback)
            // This can happen for malformed messages
        }
    }

    return compiled;
}

/**
 * Pre-compiled English messages for use in tests.
 * Using compiled messages eliminates the formatjs pre-compile warning.
 */
export const compiledDefaultMessages = compileMessages(defaultMessages);
