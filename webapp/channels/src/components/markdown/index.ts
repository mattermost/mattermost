// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, type ConnectedProps} from 'react-redux';

import type {PostImage, PostType} from '@mattermost/types/posts';

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelNameToDisplayNameMap} from 'mattermost-redux/selectors/entities/channels';
import {getAutolinkedUrlSchemes, getConfig, getManagedResourcePaths} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getAllUserMentionKeys} from 'mattermost-redux/selectors/entities/search';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getEmojiMap} from 'selectors/emojis';

import type EmojiMap from 'utils/emoji_map';
import type {ChannelNamesMap, MentionKey, TextFormattingOptions} from 'utils/text_formatting';
import {getSiteURL} from 'utils/url';

import type {GlobalState} from 'types/store';

import Markdown from './markdown';

export type OwnProps = {
    channelNamesMap?: ChannelNamesMap;

    /*
     * An array of words that can be used to mention a user
     */
    mentionKeys?: MentionKey[];

    /*
     * The text to be rendered
     */
    message?: string;

    /*
     * Any additional text formatting options to be used
     */
    options?: Partial<TextFormattingOptions>;

    /**
     * Whether or not to proxy image URLs
     */
    proxyImages?: boolean;

    /**
     * Any extra props that should be passed into the image component
     */
    imageProps?: object;

    /**
     * prop for passed down to image component for dimensions
     */
    imagesMetadata?: Record<string, PostImage>;

    /**
     * Whether or not to place the LinkTooltip component inside links
     */
    hasPluginTooltips?: boolean;

    /**
     * Post id prop passed down to markdown image
     */
    postId?: string;

    /**
     * When the post is edited this is the timestamp it happened at
     */
    editedAt?: number;

    channelId?: string;

    /**
     * Post id prop passed down to markdown image
     */
    postType?: PostType;
    emojiMap?: EmojiMap;

    /**
     * Some components processed by messageHtmlToComponent e.g. AtSumOfMembersMention require to have a list of userIds
     */
    userIds?: string[];

    /**
     * Some additional data to pass down to rendered component to aid in rendering decisions
     */
    messageMetadata?: Record<string, string>;
}

function makeGetChannelNamesMap() {
    return createSelector(
        'makeGetChannelNamesMap',
        getChannelNameToDisplayNameMap,
        (state: GlobalState, props: OwnProps) => props && props.channelNamesMap,
        (channelNamesMap, channelMentions) => {
            if (channelMentions) {
                return Object.assign({}, channelMentions, channelNamesMap);
            }

            return channelNamesMap;
        },
    );
}

function makeMapStateToProps() {
    const getChannelNamesMap = makeGetChannelNamesMap();

    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        const config = getConfig(state);

        let channelId;
        if (ownProps.postId) {
            channelId = getPost(state, ownProps.postId)?.channel_id;
        }

        return {
            autolinkedUrlSchemes: getAutolinkedUrlSchemes(state),
            channelNamesMap: getChannelNamesMap(state, ownProps),
            enableFormatting: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', true),
            managedResourcePaths: getManagedResourcePaths(state),
            mentionKeys: ownProps.mentionKeys || getAllUserMentionKeys(state),
            siteURL: getSiteURL(),
            team: getCurrentTeam(state),
            hasImageProxy: config.HasImageProxy === 'true',
            minimumHashtagLength: parseInt(config.MinimumHashtagLength || '', 10),
            emojiMap: getEmojiMap(state),
            channelId,
        };
    };
}

const connector = connect(makeMapStateToProps);
export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(Markdown);
