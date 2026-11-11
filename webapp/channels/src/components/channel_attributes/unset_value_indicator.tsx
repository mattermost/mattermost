// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, useIntl} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import './unset_value_indicator.scss';

export const unsetValueMessage = defineMessage({
    id: 'channel_attributes.banner.token_value_unset',
    defaultMessage: 'The attribute has no value set and won\'t render in the banner, but will appear automatically the moment a value is set.',
});

type Props = {
    testId: string;
};

/**
 * Flags a banner attribute that has no value on this channel: its token renders
 * nothing until one is set.
 */
const UnsetValueIndicator = ({testId}: Props) => {
    const {formatMessage} = useIntl();
    const message = formatMessage(unsetValueMessage);

    return (
        <WithTooltip title={message}>
            <span
                className='UnsetValueIndicator'
                data-testid={testId}

                // Decorative: callers carry the state for assistive technology.
                aria-hidden={true}
            >
                <AlertCircleOutlineIcon size={16}/>
            </span>
        </WithTooltip>
    );
};

export default UnsetValueIndicator;
