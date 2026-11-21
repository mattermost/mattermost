// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import PhoneInTalkIcon from '@mattermost/compass-icons/components/phone-in-talk';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import './call_options_menu.scss';

type Props = {
    id: string;
};

/**
 * The call button in a DM header or profile popover while the current user is starting, ringing, or in a call
 * there. It only shows that state, so clicking it does nothing.
 */
const InCallButton = ({id}: Props) => {
    const {formatMessage} = useIntl();
    const label = formatMessage({
        id: 'start_call_menu.in_call',
        defaultMessage: 'In call',
        description: 'Accessible name and tooltip of the pressed call button in a DM channel header or profile popover while the user is ringing or in a call with that person.',
    });

    return (
        <WithTooltip title={label}>
            <IconButton
                id={id}
                className='InCallButton'
                size='small'
                active={true}
                aria-pressed={true}
                aria-label={label}
                icon={(
                    <span className='InCallButton__icon'>
                        <Icon glyph={<PhoneInTalkIcon/>}/>
                    </span>
                )}
            />
        </WithTooltip>
    );
};

export default InCallButton;
