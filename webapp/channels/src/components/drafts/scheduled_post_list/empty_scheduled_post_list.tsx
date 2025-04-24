// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import NoResultsIndicator from 'components/no_results_indicator';

import NoScheduledPostsIllustration from './empty_scheduled_post_list_illustration';

export default function EmptyScheduledPostList() {
    const {formatMessage} = useIntl();

    return (
        <NoResultsIndicator
            expanded={true}
            iconGraphic={NoScheduledPostsIllustration}
            title={formatMessage({
                id: 'Schedule_post.empty_state.title',
                defaultMessage: 'No scheduled drafts at the moment',
            })}
            subtitle={formatMessage({
                id: 'Schedule_post.empty_state.subtitle',
                defaultMessage:
                    'Schedule drafts to send messages at a later time. Any scheduled drafts will show up here and can be modified after being scheduled.',
            })}
        />
    );
}
