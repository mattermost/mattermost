// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {fallbackContext, usePluginContext} from './context';

export interface FormatTextOptions {

    /**
     * Whether or not to render at-mentions in text.
     *
     * This requires the use of `messageHtmlToComponent.
     *
     * Defaults to `false`.
     */
    atMentions?: boolean;

    /**
     * An object mapping channel names to channel objects. If provided, ~channel links will be replaced with links to
     * the corresponding channel.
     *
     * This requires the use of `messageHtmlToComponent`.
     */
    channelNamesMap?: Record<string, Channel | string>;

    /**
     * The current team.
     */
    team?: Team;

    /**
     * Whether or not to render Markdown in the post.
     *
     * Defaults to `true`.
     */
    markdown?: boolean;

    /**
     * Specifies whether or not to highlight mentions of the current user.
     *
     * Defaults to `true`.
     */
    mentionHighlight?: boolean;

    /**
     * The external URL of this Mattermost server (eg. `https://community.mattermost.com`).
     *
     * If provided, links to channels and posts will be replaced with internal
     * links that can be handled by a special click handler.
     */
    siteURL?: string;

    /**
     * If true, the renderer will assume links are not safe. This makes external links in the text not clickable.
     *
     * Defaults to `false`.
     */
    unsafeLinks?: boolean;
}

export interface MessageHtmlToComponentOptions {

    /**
     * Whether or not the AtMention component should attempt to fetch at-mentioned users if none can be found for
     * something that looks like an at-mention. This defaults to false because the web app currently loads at-mentioned
     * users automatically for all posts.
     *
     * Defaults to `false`.
     */
    fetchMissingUsers?: boolean;
}

export interface FormatTextToComponentOptions extends FormatTextOptions, MessageHtmlToComponentOptions {}

export function useFormatTextToComponent(options?: FormatTextToComponentOptions) {
    const context = usePluginContext();

    let formatText;
    let messageHtmlToComponent;
    if (context === fallbackContext && (!window?.PostUtils?.formatText || !window?.PostUtils?.formatText)) {
        formatText = window.PostUtils.formatText;
        messageHtmlToComponent = window.PostUtils.messageHtmlToComponent;
    } else {
        formatText = context.formatText;
        messageHtmlToComponent = context.messageHtmlToComponent;
    }

    return useCallback((text: string) => {
        return messageHtmlToComponent(formatText(text, options), options);
    }, [formatText, messageHtmlToComponent, options]);
}
