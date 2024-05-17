// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {setThreadFollow} from 'mattermost-redux/actions/threads';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getBool, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getCurrentTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';

import {
    flagPost,
    unflagPost,
    pinPost,
    unpinPost,
    setEditingPost,
    markPostAsUnread,
} from 'actions/post_actions';
import {openModal} from 'actions/views/modals';
import {makeCanWrangler} from 'selectors/posts';
import {getIsMobileView} from 'selectors/views/browser';

import {isArchivedChannel} from 'utils/channel_utils';
import {Locations, Preferences} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';
import {matchUserMentionTriggersWithMessageMentions} from 'utils/post_utils';
import {allAtMentions} from 'utils/text_formatting';
import {getSiteURL} from 'utils/url';

import type {GlobalState} from 'types/store';

import DotMenu from './dot_menu';

type Props = {
    post: Post;
    isFlagged?: boolean;
    handleCommentClick?: React.EventHandler<React.MouseEvent | React.KeyboardEvent>;
    handleCardClick?: (post: Post) => void;
    handleDropdownOpened: (open: boolean) => void;
    handleAddReactionClick?: () => void;
    isMenuOpen: boolean;
    isReadOnly?: boolean;
    enableEmojiPicker?: boolean;
    location?: ComponentProps<typeof DotMenu>['location'];
};

function makeMapStateToProps() {
    const getThreadOrSynthetic = makeGetThreadOrSynthetic();
    const canWrangler = makeCanWrangler();

    return function mapStateToProps(state: GlobalState, ownProps: Props) {
        const {post} = ownProps;

        const license = getLicense(state);
        const config = getConfig(state);
        const userId = getCurrentUserId(state);
        const channel = getChannel(state, post.channel_id);
        const currentTeam = getCurrentTeam(state);
        const team = channel ? getTeam(state, channel.team_id) : undefined;
        const teamUrl = `${getSiteURL()}/${team?.name || currentTeam?.name}`;
        const isMilitaryTime = getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false);

        const systemMessage = isSystemMessage(post);
        const collapsedThreads = isCollapsedThreadsEnabled(state);

        const rootId = post.root_id || post.id;
        let threadId = rootId;
        let isFollowingThread = false;
        let isMentionedInRootPost = false;
        let threadReplyCount = 0;

        if (
            collapsedThreads &&
            rootId && !systemMessage &&
            (

                // default prop location would be CENTER
                !ownProps.location ||
                ownProps.location === Locations.RHS_ROOT ||
                ownProps.location === Locations.RHS_COMMENT ||
                ownProps.location === Locations.CENTER
            )
        ) {
            const root = getPost(state, rootId);
            if (root) {
                const thread = getThreadOrSynthetic(state, root);
                threadReplyCount = thread.reply_count;
                const currentUserMentionKeys = getCurrentUserMentionKeys(state);
                const rootMessageMentionKeys = allAtMentions(root.message);
                isFollowingThread = thread.is_following;
                isMentionedInRootPost = thread.reply_count === 0 &&
                    matchUserMentionTriggersWithMessageMentions(currentUserMentionKeys, rootMessageMentionKeys);
                threadId = thread.id;
            }
        }

        return {
            channelIsArchived: isArchivedChannel(channel),
            components: state.plugins.components,
            postEditTimeLimit: config.PostEditTimeLimit,
            isLicensed: license.IsLicensed === 'true',
            teamId: getCurrentTeamId(state),
            canEdit: PostUtils.canEditPost(state, post, license, config, channel, userId),
            canDelete: PostUtils.canDeletePost(state, post, channel),
            teamUrl,
            userId,
            threadId,
            isFollowingThread,
            isMentionedInRootPost,
            isCollapsedThreadsEnabled: collapsedThreads,
            threadReplyCount,
            isMobileView: getIsMobileView(state),
            timezone: getCurrentTimezone(state),
            isMilitaryTime,
            canMove: channel ? canWrangler(state, channel.type, threadReplyCount) : false,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            flagPost,
            unflagPost,
            setEditingPost,
            pinPost,
            unpinPost,
            openModal,
            markPostAsUnread,
            setThreadFollow,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(DotMenu);
