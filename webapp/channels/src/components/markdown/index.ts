// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelNameToDisplayNameMap} from 'mattermost-redux/selectors/entities/channels';
import {getAutolinkedUrlSchemes, getConfig, getManagedResourcePaths} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getAllUserMentionKeys} from 'mattermost-redux/selectors/entities/search';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {GlobalState} from 'types/store';
import {getEmojiMap} from 'selectors/emojis';

import {getSiteURL} from 'utils/url';
import {ChannelNamesMap, MentionKey} from 'utils/text_formatting';

import Markdown from './markdown';

type Props = {
    channelNamesMap?: ChannelNamesMap;
    mentionKeys?: MentionKey[];
    postId?: string;
}

function makeGetChannelNamesMap() {
    return createSelector(
        'makeGetChannelNamesMap',
        getChannelNameToDisplayNameMap,
        (state: GlobalState, props: Props) => props && props.channelNamesMap,
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

    return function mapStateToProps(state: GlobalState, ownProps: Props) {
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

export default connect(makeMapStateToProps)(Markdown);
