// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import Action from 'components/drafts/draft_actions/action';

import './style.scss';

function ScheduledPostActions() {
    return (
        <div className='ScheduledPostActions'>
            <Action
                icon='icon-trash-can-outline'
                id='delete'
                name='delete'
                tooltipText={(
                    <FormattedMessage
                        id='scheduled_post.action.delete'
                        defaultMessage='Delete scheduled post'
                    />
                )}
                onClick={() => {}}
            />

            <Action
                icon='icon-pencil-outline'
                id='delete'
                name='delete'
                tooltipText={(
                    <FormattedMessage
                        id='scheduled_post.action.edit'
                        defaultMessage='Edit scheduled post'
                    />
                )}
                onClick={() => {}}
            />

            <Action
                icon='icon-clock-send-outline'
                id='delete'
                name='delete'
                tooltipText={(
                    <FormattedMessage
                        id='scheduled_post.action.rescheduled'
                        defaultMessage='Reschedule post'
                    />
                )}
                onClick={() => {}}
            />

            <Action
                icon='icon-send-outline'
                id='delete'
                name='delete'
                tooltipText={(
                    <FormattedMessage
                        id='scheduled_post.action.send_now'
                        defaultMessage='Send now'
                    />
                )}
                onClick={() => {}}
            />
        </div>
    );
}

export default memo(ScheduledPostActions);
