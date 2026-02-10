// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAutolinkedUrlSchemes, getConfig} from 'mattermost-redux/selectors/entities/general';

import store from 'stores/redux_store';

import type EmojiMap from 'utils/emoji_map';
import RemoveMarkdown from 'utils/markdown/remove_markdown';
import {convertEntityToCharacter} from 'utils/text_formatting';
import {getScheme} from 'utils/url';

import Renderer from './renderer';

const removeMarkdown = new RemoveMarkdown();

// Pre/post processing tokens: control chars that survive HTML escaping and markdown processing
const UL_OPEN = '\x00u\x01';
const UL_CLOSE = '\x00/u\x01';
const SP_OPEN = '\x00s\x01';
const SP_CLOSE = '\x00/s\x01';

/**
 * Pre-process markdown text to handle features that require lexer-level changes
 * (underline via __text__, spoiler mid-text fix for ||text||).
 *
 * Replaces target patterns with control-char tokens that marked will pass through
 * as opaque text, then postprocessMarkdown converts them to the final HTML.
 */
export function preprocessMarkdown(text: string, extraFormatting: boolean, spoiler: boolean): string {
    let result = text;

    if (extraFormatting) {
        // Skip: code blocks, code spans, markdown links, bare URLs.
        // Replace __text__ with underline tokens.
        result = result.replace(
            /(```[\s\S]*?```|`[^`\n]+`|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+)|__([\s\S]+?)__(?!_)/g,
            (_match, skip, content) => {
                if (skip) {
                    return skip;
                }
                return UL_OPEN + content + UL_CLOSE;
            },
        );
    }

    if (spoiler) {
        // Skip code blocks and code spans. Replace ||text|| with spoiler tokens.
        // This fixes the mid-text spoiler bug where marked's text rule consumes
        // past || because | isn't in its lookahead stop characters.
        result = result.replace(
            /(```[\s\S]*?```|`[^`\n]+`)|\|\|([^|]+(?:\|(?!\|)[^|]*)*)\|\|/g,
            (_match, skip, content) => {
                if (skip) {
                    return skip;
                }
                return SP_OPEN + content + SP_CLOSE;
            },
        );
    }

    return result;
}

/**
 * Post-process marked output to convert placeholder tokens into final HTML.
 */
export function postprocessMarkdown(html: string, extraFormatting: boolean, spoiler: boolean): string {
    let result = html;

    if (extraFormatting) {
        result = result.split(UL_OPEN).join('<u>');
        result = result.split(UL_CLOSE).join('</u>');
    }

    if (spoiler) {
        result = result.split(SP_OPEN).join('<span class="markdown-spoiler" data-spoiler="true">');
        result = result.split(SP_CLOSE).join('</span>');
    }

    return result;
}

export function format(text: string, options = {}, emojiMap?: EmojiMap) {
    return formatWithRenderer(text, new Renderer({}, options, emojiMap));
}

export function formatWithRenderer(text: string, renderer: marked.Renderer) {
    const state = store.getState();
    const config = getConfig(state);
    const urlFilter = getAutolinkedUrlSchemeFilter(state);

    const extraFormatting = config.FeatureFlagExtraFormatting === 'true';
    const spoiler = config.FeatureFlagSpoilers === 'true';
    const shouldPreprocess = !(renderer instanceof RemoveMarkdown);

    const preprocessed = shouldPreprocess ? preprocessMarkdown(text, extraFormatting, spoiler) : text;

    const markdownOptions = {
        renderer,
        sanitize: true,
        gfm: true,
        tables: true,
        mangle: false,
        inlinelatex: config.EnableLatex === 'true' && config.EnableInlineLatex === 'true',
        spoiler,
        urlFilter,
    };

    const rendered = marked(preprocessed, markdownOptions).trim();

    return shouldPreprocess ? postprocessMarkdown(rendered, extraFormatting, spoiler) : rendered;
}

const getAutolinkedUrlSchemeFilter = createSelector(
    'getAutolinkedUrlSchemeFilter',
    getAutolinkedUrlSchemes,
    (autolinkedUrlSchemes: string[]) => {
        return (url: string) => {
            const scheme = getScheme(url);

            return !scheme || autolinkedUrlSchemes.includes(scheme);
        };
    },
);

export function stripMarkdown(text: string) {
    if (typeof text === 'string' && text.length > 0) {
        return convertEntityToCharacter(
            formatWithRenderer(text, removeMarkdown),
        ).trim();
    }

    return text;
}
