// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {ensureString} from 'mattermost-redux/utils/post_utils';

import ProfilePicture from 'components/profile_picture';
import MattermostLogo from 'components/widgets/icons/mattermost_logo';

import Constants, {UserStatuses} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';
import * as Utils from 'utils/utils';

type Props = {
    availabilityStatusOnPosts: string;
    compactDisplay?: boolean;
    enablePostIconOverride: boolean;
    hasImageProxy: boolean;
    post: Post;
    status?: string;
    user: UserProfile;
    isBot?: boolean;
    overwriteIcon?: string;
}

export default class PostProfilePicture extends React.PureComponent<Props> {
    static defaultProps = {
        status: UserStatuses.OFFLINE,
    };

    getProfilePictureURL = (): string => {
        const {post, user} = this.props;

        if (user && user.id === post.user_id) {
            return Utils.imageURLForUser(user.id, user.last_picture_update);
        } else if (post.user_id) {
            return Utils.imageURLForUser(post.user_id);
        }

        return '';
    };

    getStatus = (fromAutoResponder: boolean, fromWebhook: boolean, user: UserProfile): string | undefined => {
        if (fromAutoResponder || fromWebhook || (user && user.is_bot)) {
            return '';
        }

        return this.props.status;
    };

    getPostIconURL = (defaultURL: string, fromAutoResponder: boolean, fromWebhook: boolean): string => {
        const {enablePostIconOverride, hasImageProxy, post} = this.props;
        const postProps = post.props;
        const postIconOverrideURL = ensureString(postProps?.override_icon_url);
        const useUserIcon = ensureString(postProps?.use_user_icon);

        if (this.props.compactDisplay) {
            return '';
        }

        if (!fromAutoResponder && fromWebhook && !useUserIcon && enablePostIconOverride) {
            if (postIconOverrideURL && postIconOverrideURL !== '') {
                return PostUtils.getImageSrc(postIconOverrideURL, hasImageProxy);
            }

            return Constants.DEFAULT_WEBHOOK_LOGO;
        }

        return defaultURL;
    };

    render() {
        const {
            availabilityStatusOnPosts,
            compactDisplay,
            post,
            user,
            isBot,
        } = this.props;

        const isSystemMessage = PostUtils.isSystemMessage(post);
        const fromWebhook = PostUtils.isFromWebhook(post);

        if (isSystemMessage && !compactDisplay && !fromWebhook && !isBot) {
            return <MattermostLogo className='icon'/>;
        }
        const fromAutoResponder = PostUtils.fromAutoResponder(post);

        const profileSrc = this.getProfilePictureURL();
        const src = this.getPostIconURL(profileSrc, fromAutoResponder, fromWebhook);

        const overrideIconEmoji = ensureString(post.props.override_icon_emoji);
        const overwriteName = ensureString(post.props?.override_username);
        const isEmoji = overrideIconEmoji !== '';
        const status = this.getStatus(fromAutoResponder, fromWebhook, user);

        return (
            <ProfilePicture
                size='md'
                src={src}
                profileSrc={profileSrc}
                isEmoji={isEmoji}
                status={availabilityStatusOnPosts === 'true' ? status : ''}
                userId={user?.id}
                channelId={post.channel_id}
                username={user?.username}
                overwriteIcon={this.props.overwriteIcon}
                overwriteName={overwriteName}
                isBot={user?.is_bot}
                fromAutoResponder={fromAutoResponder}
                fromWebhook={fromWebhook}
            />
        );
    }
}
