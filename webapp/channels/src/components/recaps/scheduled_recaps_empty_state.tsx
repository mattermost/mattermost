// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';

type Props = {
    onCreateClick: () => void;
    disabled?: boolean;
};

const ScheduledRecapsEmptyState = ({onCreateClick, disabled}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className='scheduled-recaps-empty-state'>
            <div className='empty-state-illustration'>
                {/* Simplified illustration - matches Figma design concept */}
                <div className='illustration-icons'>
                    <i className='icon icon-message-text-outline'/>
                    <i className='icon icon-calendar-outline'/>
                    <i className='icon icon-file-document-outline'/>
                </div>
            </div>
            <h2 className='empty-state-title'>
                {formatMessage({id: 'recaps.scheduled.emptyState.title', defaultMessage: 'Set up your first recap'})}
            </h2>
            <p className='empty-state-description'>
                {formatMessage({
                    id: 'recaps.scheduled.emptyState.description',
                    defaultMessage: 'Copilot recaps help you get caught up quickly on discussions that are most important to you with a summarized report.',
                })}
            </p>
            <button
                className='btn btn-primary empty-state-cta'
                onClick={onCreateClick}
                disabled={disabled}
            >
                <PlusIcon size={16}/>
                {formatMessage({id: 'recaps.scheduled.emptyState.cta', defaultMessage: 'Create a recap'})}
            </button>
        </div>
    );
};

export default ScheduledRecapsEmptyState;
