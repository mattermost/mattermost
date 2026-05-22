// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {SchedulePerspective} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';

import './schedule_perspective_toggle.scss';

type Props = {
    perspective: SchedulePerspective;
    recipientFirstName: string;
    onChange: (perspective: SchedulePerspective) => void;
}

export default function SchedulePerspectiveToggle({perspective, recipientFirstName, onChange}: Props) {
    const handleMineClick = useCallback(() => onChange('mine'), [onChange]);
    const handleTheirsClick = useCallback(() => onChange('theirs'), [onChange]);

    return (
        <div
            className='SchedulePerspectiveToggle'
            role='radiogroup'
            aria-label='Schedule time perspective'
        >
            <button
                type='button'
                className='SchedulePerspectiveToggle__option'
                role='radio'
                aria-checked={perspective === 'mine'}
                data-selected={perspective === 'mine'}
                onClick={handleMineClick}
            >
                <FormattedMessage
                    id='schedule_post.custom_time_modal.perspective.mine'
                    defaultMessage='My time'
                />
            </button>
            <button
                type='button'
                className='SchedulePerspectiveToggle__option'
                role='radio'
                aria-checked={perspective === 'theirs'}
                data-selected={perspective === 'theirs'}
                onClick={handleTheirsClick}
            >
                <FormattedMessage
                    id='schedule_post.custom_time_modal.perspective.theirs'
                    defaultMessage="{name}'s time"
                    values={{name: recipientFirstName}}
                />
            </button>
        </div>
    );
}
