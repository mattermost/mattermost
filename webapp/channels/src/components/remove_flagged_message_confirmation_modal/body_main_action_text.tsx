// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import AtMention from 'components/at_mention';
import {useChannel} from 'components/common/hooks/useChannel';
import {useUser} from 'components/common/hooks/useUser';

type Props = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
};

export default function BodyMainActionText({
    action,
    flaggedPost,
    reportingUser,
}: Props) {
    const {formatMessage} = useIntl();
    const flaggedPostAuthor = useUser(flaggedPost.user_id);
    const flaggedPostChannel = useChannel(flaggedPost.channel_id);

    const values = {
        flaggedPostChannel: flaggedPostChannel?.display_name,
        reportingUser: (
            <AtMention mentionName={reportingUser?.username || ''}/>
        ),
        flaggedPostAuthor: (
            <AtMention mentionName={flaggedPostAuthor?.username || ''}/>
        ),
    };

    let body;

    if (action === 'remove') {
        body = formatMessage(
            {
                id: 'keep_remove_quarantined_content_modal.action_remove.body',
                defaultMessage:
                    'You are about to remove a message authored by {flaggedPostAuthor} posted in the {flaggedPostChannel} channel and quarantined for review by {reportingUser}.',
            },
            values,
        );
    } else {
        body = formatMessage(
            {
                id: 'keep_remove_quarantined_content_modal.action_keep.body',
                defaultMessage:
                    'You are about to keep a quarantined message authored by {flaggedPostAuthor} posted in the {flaggedPostChannel} channel and quarantined for review by {reportingUser}.',
            },
            values,
        );
    }

    return <p>{body}</p>;
}
