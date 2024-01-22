// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {Constants} from 'utils/constants';

type Props = {
    className?: string;
    withTooltip?: boolean;
};

const SharedUserIndicator: React.FC<Props> = (props: Props): JSX.Element => {
    const intl = useIntl();

    const sharedIcon = (
        <i
            className={`${props.className || ''} icon-circle-multiple-outline`}
            aria-label={intl.formatMessage({id: 'shared_user_indicator.aria_label', defaultMessage: 'shared user indicator'})}
        />
    );

    if (!props.withTooltip) {
        return sharedIcon;
    }

    const sharedTooltip = (
        <Tooltip id='sharedTooltip'>
            <FormattedMessage
                id='shared_user_indicator.tooltip'
                defaultMessage='From trusted organizations'
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

export default SharedUserIndicator;
