// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import NoResultsIndicator from 'components/no_results_indicator';
import {ScheduledEmptyIllustration} from 'components/no_results_indicator/no_results_variant_illustration';

export default function EmptyScheduledPostList() {
    const {formatMessage} = useIntl();

    return (
        <NoResultsIndicator
            expanded={true}
            iconGraphic={<ScheduledEmptyIllustration/>}
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
