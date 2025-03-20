// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {hasScheduledPostError} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import AlertBanner from 'components/alert_banner';

import type {GlobalState} from 'types/store';

export default function ScheduledPostError() {
    const currentTeamId = useSelector(getCurrentTeamId);

    const scheduledPostsHasError = useSelector((state: GlobalState) => hasScheduledPostError(state, currentTeamId));

    if (!scheduledPostsHasError) {
        return null;
    }

    return (
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
    );
}
