// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertBanner from 'components/alert_banner';

export default function ScheduledPostError() {
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
