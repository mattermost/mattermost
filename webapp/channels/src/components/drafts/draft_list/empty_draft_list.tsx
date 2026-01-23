// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';

import EmptyDraftListIllustration from './empty_draft_list_illustration';

export default function EmptyDraftList() {
    const {formatMessage} = useIntl();

    return (
        <div className='DraftList Drafts__main'>
            <NoResultsIndicator
                expanded={true}
                iconGraphic={EmptyDraftListIllustration}
                title={formatMessage({
                    id: 'drafts.empty.title',
                    defaultMessage: 'No drafts at the moment',
                })}
                subtitle={formatMessage({
                    id: 'drafts.empty.subtitle',
                    defaultMessage: 'Any messages you’ve started will show here.',
                })}
            />
        </div>
    );
}
