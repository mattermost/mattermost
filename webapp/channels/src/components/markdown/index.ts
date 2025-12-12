// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, type ConnectedProps} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelNameToDisplayNameMap} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getManagedResourcePaths} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getAllUserMentionKeys} from 'mattermost-redux/selectors/entities/search';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getEmojiMap} from 'selectors/emojis';

import {getSiteURL} from 'utils/url';

import type {GlobalState} from 'types/store';

import Markdown, {type OwnProps} from './markdown';

function makeGetChannelNamesMap() {
    return createSelector(
        'makeGetChannelNamesMap',
        getChannelNameToDisplayNameMap,
        (_: GlobalState, props: OwnProps) => props && props.channelNamesMap,
        (state: GlobalState, props: OwnProps) => (props.postId ? getPost(state, props.postId)?.props?.channel_mentions : undefined),
        (channelNamesMap, propsChannelMentions, postChannelMentions) => {
            // Use channel_mentions from post.props as source of truth (most up-to-date)
            // This ensures selector re-runs when post.props.channel_mentions changes
            const channelMentions = postChannelMentions || propsChannelMentions;

            if (channelMentions) {
                // Server data (channelMentions) takes precedence over Redux data (channelNamesMap)
                return Object.assign({}, channelNamesMap, channelMentions);
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
