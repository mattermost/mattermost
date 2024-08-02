// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {AriaRole, AriaAttributes} from 'react';
import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

type Props = {
    id: string;

    /**
     * If not provided, the default title 'From trusted organizations' will be used for the tooltip.
    */
    title?: string;
    ariaLabel?: AriaAttributes['aria-label'];
    role?: AriaRole;

    className?: string;
    withTooltip?: boolean;
    placement?: string;
};

const SharedUserIndicator = (props: Props) => {
    const intl = useIntl();

    const sharedIcon = (
        <i
            className={classNames('icon icon-circle-multiple-outline', props.className)}
            aria-label={props.ariaLabel || intl.formatMessage({id: 'shared_user_indicator.aria_label', defaultMessage: 'shared user indicator'})}
            role={props?.role}
        />
    );

    if (!props.withTooltip) {
        return sharedIcon;
    }

    return (
        <WithTooltip
            id={props.id}
            title={props.title || intl.formatMessage({id: 'shared_user_indicator.tooltip', defaultMessage: 'From trusted organizations'})}
            placement={props.placement || 'bottom'}
        >
            {sharedIcon}
        </WithTooltip>
    );
};

export default SharedUserIndicator;
