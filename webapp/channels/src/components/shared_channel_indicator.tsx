// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelType} from '@mattermost/types/channels';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

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

    const sharedTooltip = (
        <Tooltip id='sharedTooltip'>
            <FormattedMessage
                id='shared_channel_indicator.tooltip'
                defaultMessage='Shared with trusted organizations'
            />
        </Tooltip>
    );

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='bottom'
            overlay={sharedTooltip}
        >
            {sharedIcon}
        </OverlayTrigger>
    );
};

export default SharedChannelIndicator;
