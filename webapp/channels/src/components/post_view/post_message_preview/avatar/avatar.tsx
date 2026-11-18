// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

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
    testIdScope?: string;
};

export default function PreviewPostAvatar({post, user, enablePostIconOverride, hasImageProxy, testIdScope}: Props) {
    const isBot = Boolean(user && user.is_bot);
    const isSystemMessage = post ? PostUtils.isSystemMessage(post) : false;
    const fromWebhook = post ? PostUtils.isFromWebhook(post) : false;
    const fromAutoResponder = post ? PostUtils.fromAutoResponder(post) : false;

    const src = useMemo(() => {
        const postProps = post?.props;
        const postIconOverrideURL = ensureString(postProps?.override_icon_url);
        const useUserIcon = ensureString(postProps?.use_user_icon);

        if (!fromAutoResponder && fromWebhook && !useUserIcon && enablePostIconOverride) {
            if (postIconOverrideURL && postIconOverrideURL !== '') {
                return PostUtils.getImageSrc(postIconOverrideURL, hasImageProxy);
            }
            return Constants.DEFAULT_WEBHOOK_LOGO;
        }

        return imageURLForUser(user?.id ?? '');
    }, [enablePostIconOverride, fromAutoResponder, fromWebhook, hasImageProxy, post?.props, user?.id]);

    if (isSystemMessage && !fromWebhook && !isBot) {
        return (<MattermostLogo className='icon'/>);
    }

    return (
        <Avatar
            username={user?.id ? user.username : undefined}
            size={'sm'}
            url={src}
            className={'avatar-post-preview'}
            data-testid={testIdScope ? `${testIdScope}.avatar--img` : undefined}
        />
    );
}
