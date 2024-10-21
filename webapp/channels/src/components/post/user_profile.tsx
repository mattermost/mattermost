// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import PostHeaderCustomStatus from 'components/post_view/post_header_custom_status/post_header_custom_status';
import UserProfile from 'components/user_profile';
import BotTag from 'components/widgets/tag/bot_tag';
import Tag from 'components/widgets/tag/tag';

import {Preferences} from 'utils/constants';
import {fromAutoResponder, isFromWebhook} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

type Props = {
    post: Post;
    compactDisplay?: boolean;
    isConsecutivePost?: boolean;
    isSystemMessage: boolean;
    isMobileView: boolean;
};

const automaticReplyText = (
    <FormattedMessage
        id='post_info.auto_responder'
        defaultMessage='AUTOMATIC REPLY'
    />
);

const PostUserProfile = ({
    isMobileView,
    isSystemMessage,
    post,
    compactDisplay,
    isConsecutivePost,
}: Props): JSX.Element | null => {
    const intl = useIntl();
    const enablePostUsernameOverride = useSelector((state: GlobalState) => getConfig(state).EnablePostUsernameOverride === 'true');
    const isFromAutoResponder = fromAutoResponder(post);
    const colorize = useSelector((state: GlobalState) => (compactDisplay && get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLORIZE_USERNAMES, Preferences.COLORIZE_USERNAMES_DEFAULT) === 'true'));
    const isBot = useSelector((state: GlobalState) => getUser(state, post.user_id)?.is_bot);

    let userProfile: ReactNode = null;
    let botIndicator = null;
    const colon = compactDisplay && <strong className='colon'>{':'}</strong>;

    const customStatus = (
        <PostHeaderCustomStatus
            userId={post.user_id}
            isBot={isBot || post.props.from_webhook === 'true'}
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
            const overwriteName = post.props.override_username && enablePostUsernameOverride ? post.props.override_username : undefined;
            userProfile = (
                <UserProfile
                    userId={post.user_id}
                    channelId={post.channel_id}
                    hideStatus={true}
                    overwriteName={overwriteName}
                    colorize={colorize}
                    overwriteIcon={post.props.override_icon_url || undefined}
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
            botIndicator = <Tag text={automaticReplyText}/>;
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
