// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type Luxon from 'luxon';
import type PropTypes from 'prop-types';
import type React from 'react';
import type ReactBootstrap from 'react-bootstrap';
import type ReactDOM from 'react-dom';
import type ReactIntl from 'react-intl';
import type ReactRedux from 'react-redux';
import type ReactRouterDom from 'react-router-dom';
import type Redux from 'redux';
import type StyledComponents from 'styled-components';

import type {WebSocketClient, WebSocketMessage} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

export interface TextFormattingOptions {

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

export interface WindowExports {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    ReactIntl: typeof ReactIntl;
    Redux: typeof Redux;
    ReactRedux: typeof ReactRedux;
    ReactBootstrap: typeof ReactBootstrap;
    ReactRouterDom: typeof ReactRouterDom;
    PropTypes: typeof PropTypes;
    Luxon: typeof Luxon;
    StyledComponents: typeof StyledComponents;
}

export interface WindowPostUtils {
    formatText(text: string, options?: TextFormattingOptions): string;
    messageHtmlToComponent(html: string, options?: MessageHtmlToComponentOptions): JSX.Element;
}

export type UseWebSocketOptions = {
    handler: (msg: WebSocketMessage) => void;
}

export interface WindowProductApi {
    useWebSocket: (options: UseWebSocketOptions) => void;
    useWebSocketClient: () => WebSocketClient;
}

declare global {
    interface Window extends WindowExports {
        PostUtils: WindowPostUtils;
        ProductApi: WindowProductApi;
    }
}

export {};
