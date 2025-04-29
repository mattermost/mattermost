// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

type Props = {
    className?: string;
    withTooltip?: boolean;
};

const SharedChannelIndicator: React.FC<Props> = (props: Props): JSX.Element => {
    const sharedIcon = (<i className={`${props.className || ''} icon-circle-multiple-outline`}/>);

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
            title={sharedTooltipText}
        >
            {sharedIcon}
        </WithTooltip>
    );
};

export default SharedChannelIndicator;
