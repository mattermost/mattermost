// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {AriaRole, AriaAttributes} from 'react';
import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

type Props = {

    /**
     * If not provided, the default title 'From trusted organizations' will be used for the tooltip.
     */
    title?: string;
    ariaLabel?: AriaAttributes['aria-label'];
    role?: AriaRole;
    className?: string;
    withTooltip?: boolean;

    /**
     * List of remote workspace names to display in the tooltip
     */
    remoteNames?: string[];
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

    // If a title is explicitly provided, use it
    if (props.title) {
        return (
            <WithTooltip title={props.title}>
                {sharedIcon}
            </WithTooltip>
        );
    }

    // If we have remote names, use them in the tooltip
    if (props.remoteNames && props.remoteNames.length > 0) {
        return (
            <WithTooltip
                title={intl.formatMessage(
                    {id: 'shared_user_indicator.tooltip_with_names', defaultMessage: 'From: {remoteNames}'},
                    {remoteNames: props.remoteNames.join(', ')},
                )}
            >
                {sharedIcon}
            </WithTooltip>
        );
    }

    // Fallback to the generic message
    return (
        <WithTooltip
            title={intl.formatMessage({id: 'shared_user_indicator.tooltip', defaultMessage: 'From trusted organizations'})}
        >
            {sharedIcon}
        </WithTooltip>
    );
};

export default SharedUserIndicator;
