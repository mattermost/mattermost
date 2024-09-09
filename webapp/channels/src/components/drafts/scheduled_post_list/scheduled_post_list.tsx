// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import DraftsIllustration from 'components/drafts/drafts_illustration';
import ScheduledPostItem from 'components/drafts/scheduled_post/scheduled_post';
import NoResultsIndicator from 'components/no_results_indicator';

type Props = {
    scheduledPosts: ScheduledPost[];
}

export default function ScheduledPostList({scheduledPosts}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='ScheduledPostList'>
            {
                scheduledPosts.map((schedulePost) => (
                    <ScheduledPostItem
                        key={schedulePost.id}
                        scheduledPost={schedulePost}
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
