// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelType} from '@mattermost/types/channels';

import WithTooltip from 'components/with_tooltip';

import {Constants} from 'utils/constants';

type Props = {
    className?: string;
    channelType: ChannelType;
    withTooltip?: boolean;
};

const SharedChannelIndicator: React.FC<Props> = (props: Props): JSX.Element => {
    let sharedIcon;
    if (props.channelType === Constants.PRIVATE_CHANNEL) {
        sharedIcon = (<i className={`${props.className || ''} icon-circle-multiple-outline-lock`}/>);
    } else {
        sharedIcon = (<i className={`${props.className || ''} icon-circle-multiple-outline`}/>);
    }

    if (!props.withTooltip) {
        return sharedIcon;
    }

    const sharedTooltipText = (
        <FormattedMessage
            id='shared_channel_indicator.tooltip'
            defaultMessage='Shared with trusted organizations'
        />
    );

    return (
        <WithTooltip
            id='sharedTooltip'
            placement='bottom'
            title={sharedTooltipText}
        >
            {sharedIcon}
        </WithTooltip>
    );
};

export default SharedChannelIndicator;
