// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import MattermostLogo from 'components/widgets/icons/mattermost_logo';
import Avatar from 'components/widgets/users/avatar';

import {Constants} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';
import {imageURLForUser} from 'utils/utils';

type Props = {
    post?: Post;
    user: UserProfile;
    enablePostIconOverride?: boolean;
    hasImageProxy?: boolean;
};

export default function PreviewPostAvatar({post, user, enablePostIconOverride, hasImageProxy}: Props) {
    const config = useSelector(getConfig);

    const isBot = Boolean(user && user.is_bot);
    const isSystemMessage = post ? PostUtils.isSystemMessage(post) : false;
    const fromWebhook = post ? PostUtils.isFromWebhook(post) : false;
    const fromAutoResponder = post ? PostUtils.fromAutoResponder(post) : false;

    const src = useMemo(() => {
        const postProps = post?.props;
        const useUserIcon = ensureString(postProps?.use_user_icon);

        if (!fromAutoResponder && fromWebhook && !useUserIcon && enablePostIconOverride) {
            const postIconOverrideURL = PostUtils.getPostOverrideIconURL(post, config, Boolean(enablePostIconOverride));
            if (postIconOverrideURL) {
                return PostUtils.getImageSrc(postIconOverrideURL, hasImageProxy);
            }
            return Constants.DEFAULT_WEBHOOK_LOGO;
        }

        return imageURLForUser(user?.id ?? '');
    }, [config, enablePostIconOverride, fromAutoResponder, fromWebhook, hasImageProxy, post, user?.id]);

    let avatar = (
        <Avatar
            size={'sm'}
            url={src}
            className={'avatar-post-preview'}
        />
    );
    if (isSystemMessage && !fromWebhook && !isBot) {
        avatar = (<MattermostLogo className='icon'/>);
    } else if (user?.id) {
        avatar = (
            <Avatar
                username={user.username}
                size={'sm'}
                url={src}
                className={'avatar-post-preview'}
            />
        );
    }

    return avatar;
}
