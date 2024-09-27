// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {hasScheduledPostError} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import AlertBanner from 'components/alert_banner';
import NoScheduledPostsIllustration from 'components/drafts/scheduled_post_list/empty_scheduled_post_list_illustration';
import NoResultsIndicator from 'components/no_results_indicator';

import type {GlobalState} from 'types/store';

import DraftRow from '../draft_row';

import './style.scss';

type Props = {
    scheduledPosts: ScheduledPost[];
    user: UserProfile;
    displayName: string;
    status: UserStatus['status'];
}

export default function ScheduledPostList({
    scheduledPosts,
    user,
    displayName,
    status,
}: Props) {
    const {formatMessage} = useIntl();

    const currentTeamId = useSelector(getCurrentTeamId);
    const scheduledPostsHasError = useSelector((state: GlobalState) => hasScheduledPostError(state, currentTeamId));

    return (
        <div className='ScheduledPostList'>
            {
                scheduledPostsHasError &&
                <AlertBanner
                    mode='danger'
                    className='scheduledPostListErrorIndicator'
                    message={
                        <FormattedMessage
                            id='scheduled_post.panel.error_indicator.message'
                            defaultMessage='One of your scheduled drafts cannot be sent.'
                        />
                    }
                />
            }

            {
                scheduledPosts.map((scheduledPost) => (
                    <DraftRow
                        key={scheduledPost.id}
                        item={scheduledPost}
                        displayName={displayName}
                        status={status}
                        user={user}
                    />
                ))
            }

            {
                scheduledPosts.length === 0 && (
                    <NoResultsIndicator
                        expanded={true}
                        iconGraphic={NoScheduledPostsIllustration}
                        title={formatMessage({
                            id: 'Schedule_post.empty_state.title',
                            defaultMessage: 'No scheduled drafts at the moment',
                        })}
                        subtitle={formatMessage({
                            id: 'Schedule_post.empty_state.subtitle',
                            defaultMessage: 'Schedule drafts to send messages at a later time. Any scheduled drafts will show up here and can be modified after being scheduled.',
                        })}
                    />
                )
            }
        </div>
    );
}
