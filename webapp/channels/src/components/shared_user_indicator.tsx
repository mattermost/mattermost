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

    remoteNames?: string[];
};

const SharedUserIndicator = (props: Props) => {
    const intl = useIntl();

    const sharedIcon = (
        <i
            data-testid='SharedUserIcon'
            className={classNames('icon icon-circle-multiple-outline', props.className)}
            aria-label={props.ariaLabel || intl.formatMessage({id: 'shared_user_indicator.aria_label', defaultMessage: 'shared user indicator'})}
            role={props?.role}
        />
    );

    if (!props.withTooltip) {
        return sharedIcon;
    }

    // If we have remote names, use them in the tooltip
    if (props.remoteNames && props.remoteNames.length > 0) {
        // Show first 3 remotes and then "and N others" if there are more
        const MAX_DISPLAY_NAMES = 3;
        const MAX_TOOLTIP_LENGTH = 120; // Maximum overall tooltip length
        let remoteNamesText;

        if (props.remoteNames.length <= MAX_DISPLAY_NAMES) {
            remoteNamesText = props.remoteNames.join(', ');
        } else {
            const displayNames = props.remoteNames.slice(0, MAX_DISPLAY_NAMES);
            const remainingCount = props.remoteNames.length - MAX_DISPLAY_NAMES;
            remoteNamesText = `${displayNames.join(', ')} and ${remainingCount} other${remainingCount > 1 ? 's' : ''}`;
        }

        // Add a final truncation to enforce maximum tooltip length
        if (remoteNamesText.length > MAX_TOOLTIP_LENGTH) {
            remoteNamesText = remoteNamesText.substring(0, MAX_TOOLTIP_LENGTH - 3) + '...';
        }

        return (
            <WithTooltip
                title={intl.formatMessage(
                    {id: 'shared_user_indicator.tooltip_with_names', defaultMessage: 'From: {remoteNames}'},
                    {remoteNames: remoteNamesText},
                )}
            >
                {sharedIcon}
            </WithTooltip>
        );
    }

    // Fallback to the generic message
    return (
        <WithTooltip
            title={props.title || intl.formatMessage({id: 'shared_user_indicator.tooltip', defaultMessage: 'From trusted organizations'})}
        >
            {sharedIcon}
        </WithTooltip>
    );
};

export default SharedUserIndicator;
