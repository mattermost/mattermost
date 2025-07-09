// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAutolinkedUrlSchemes, getConfig} from 'mattermost-redux/selectors/entities/general';

import store from 'stores/redux_store';

import Constants from 'utils/constants';
import type EmojiMap from 'utils/emoji_map';
import RemoveMarkdown from 'utils/markdown/remove_markdown';
import {convertEntityToCharacter} from 'utils/text_formatting';
import {getScheme} from 'utils/url';

import Renderer from './renderer';

const removeMarkdown = new RemoveMarkdown();

export function format(text: string, options = {}, emojiMap?: EmojiMap) {
    return formatWithRenderer(text, new Renderer({}, options, emojiMap));
}

export function formatWithRenderer(text: string, renderer: marked.Renderer) {
    const state = store.getState();
    const config = getConfig(state);
    const urlFilter = getAutolinkedUrlSchemeFilter(state);

    const markdownOptions = {
        renderer,
        sanitize: true,
        gfm: true,
        tables: true,
        mangle: false,
        inlinelatex: config.EnableLatex === 'true' && config.EnableInlineLatex === 'true',
        urlFilter,
    };

    return marked(text, markdownOptions).trim();
}

export function formatWithRendererForMentions(text: string, renderer: marked.Renderer) {
    const config = getConfig(store.getState());

    // Protect remote mentions (containing colons) from being split by marked
    const remoteMentions: Map<string, string> = new Map();
    let counter = 0;

    const protectedText = text.replace(Constants.MENTIONS_REGEX, (match) => {
        if (match.includes(':')) {
            const placeholder = `REMOTE_MENTION_${counter++}_END`;
            remoteMentions.set(placeholder, match);
            return placeholder;
        }
        return match;
    });

    const markdownOptions = {
        renderer,
        sanitize: true,
        gfm: true,
        tables: true,
        mangle: false,
        inlinelatex: config.EnableLatex === 'true' && config.EnableInlineLatex === 'true',
    };

    let result = marked(protectedText, markdownOptions).trim();

    // Restore protected mentions
    remoteMentions.forEach((mention, placeholder) => {
        result = result.replace(new RegExp(placeholder, 'g'), mention);
    });

    return result;
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
