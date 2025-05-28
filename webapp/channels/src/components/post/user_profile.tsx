// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {ensureString} from 'mattermost-redux/utils/post_utils';

import PostHeaderCustomStatus from 'components/post_view/post_header_custom_status/post_header_custom_status';
import UserProfile from 'components/user_profile';
import BotTag from 'components/widgets/tag/bot_tag';
import Tag from 'components/widgets/tag/tag';

import {fromAutoResponder, isFromWebhook} from 'utils/post_utils';

type Props = {
    post: Post;
    compactDisplay?: boolean;
    colorizeUsernames?: boolean;
    enablePostUsernameOverride?: boolean;
    isConsecutivePost?: boolean;
    isBot: boolean;
    isSystemMessage: boolean;
    isMobileView: boolean;
};

const PostUserProfile = (props: Props): JSX.Element | null => {
    const intl = useIntl();
    const {post, compactDisplay, isMobileView, isConsecutivePost, enablePostUsernameOverride, isBot, isSystemMessage, colorizeUsernames} = props;
    const isFromAutoResponder = fromAutoResponder(post);
    const colorize = compactDisplay && colorizeUsernames;

    let userProfile: ReactNode = null;
    let botIndicator = null;
    let colon = null;

    if (props.compactDisplay) {
        colon = <strong className='colon'>{':'}</strong>;
    }

    const customStatus = (
        <PostHeaderCustomStatus
            userId={props.post.user_id}
            isBot={props.isBot || post.props.from_webhook === 'true'}
            isSystemMessage={isSystemMessage}
        />
    );

    if (compactDisplay || isMobileView) {
        userProfile = (
            <UserProfile
                userId={post.user_id}
                channelId={post.channel_id}
                colorize={colorize}
            />
        );
    }

    if (isConsecutivePost) {
        userProfile = (
            <UserProfile
                userId={post.user_id}
                channelId={post.channel_id}
                colorize={colorize}
            />
        );
    } else {
        userProfile = (
            <UserProfile
                userId={post.user_id}
                channelId={post.channel_id}
                colorize={colorize}
            />
        );

        if (isFromWebhook(post)) {
            const propOverrideName = ensureString(post.props.override_username);
            const overwriteName = propOverrideName && enablePostUsernameOverride ? propOverrideName : undefined;
            const propOverrideIcon = ensureString(post.props.override_icon_url);
            const overwriteIcon = propOverrideIcon || undefined;
            userProfile = (
                <UserProfile
                    userId={post.user_id}
                    channelId={post.channel_id}
                    hideStatus={true}
                    overwriteName={overwriteName}
                    colorize={colorize}
                    overwriteIcon={overwriteIcon}
                />
            );

            // user profile component checks and add bot tag in case webhook is from bot account, but if webhook is from user account we need this.

            if (!isBot) {
                botIndicator = (<BotTag/>);
            }
        } else if (isFromAutoResponder) {
            userProfile = (
                <span className='auto-responder'>
                    <UserProfile
                        userId={post.user_id}
                        channelId={post.channel_id}
                        hideStatus={true}
                        colorize={colorize}
                    />
                </span>
            );
            botIndicator = (
                <Tag
                    text={
                        <FormattedMessage
                            id='post_info.auto_responder'
                            defaultMessage='AUTOMATIC REPLY'
                        />
                    }
                />
            );
        } else if (isSystemMessage && isBot) {
            userProfile = (
                <UserProfile
                    userId={post.user_id}
                    channelId={post.channel_id}
                    hideStatus={true}
                    colorize={colorize}
                />
            );
        } else if (isSystemMessage) {
            userProfile = (
                <UserProfile
                    overwriteName={intl.formatMessage({
                        id: 'post_info.system',
                        defaultMessage: 'System',
                    })}
                    userId={post.user_id}
                    disablePopover={true}
                    channelId={post.channel_id}
                    colorize={colorize}
                />
            );
        }
    }

    return (<div className='col col__name'>
        {userProfile}
        {colon}
        {botIndicator}
        {customStatus}
    </div>);
};

export default PostUserProfile;
