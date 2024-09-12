// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import DraftsIllustration from 'components/drafts/drafts_illustration';
import ScheduledPostItem from 'components/drafts/scheduled_post/scheduled_post';
import NoResultsIndicator from 'components/no_results_indicator';
import AlertBanner from 'components/alert_banner';

import './style.scss';

type Props = {
    scheduledPosts: ScheduledPost[];
    user: UserProfile;
    displayName: string;
    status: UserStatus['status'];
}

export default function ScheduledPostList({scheduledPosts, user, displayName}: Props) {
    const {formatMessage} = useIntl();

    const scheduledPostsHasError = scheduledPosts.findIndex((scheduledPosts) => scheduledPosts.error_code);

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
                scheduledPosts.map((schedulePost) => (
                    <ScheduledPostItem
                        key={schedulePost.id}
                        scheduledPost={schedulePost}
                        user={user}
                        displayName={displayName}
                        status={status}
                    />
                ))
            }

            {
                scheduledPosts.length === 0 && (
                    <NoResultsIndicator
                        expanded={true}
                        iconGraphic={DraftsIllustration}
                        title={formatMessage({
                            id: 'Schedule_post.empty_state.title',
                            defaultMessage: 'No scheduled posts at the moment',
                        })}
                        subtitle={formatMessage({
                            id: 'Schedule_post.empty_state.subtitle',
                            defaultMessage: 'Any message you\'ve scheduled will show here.',
                        })}
                    />
                )
            }
        </div>
    );
}
