// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

type Props = {
    className?: string;
    withTooltip?: boolean;
    remoteNames?: string[];
};

const SharedChannelIndicator: React.FC<Props> = (props: Props): JSX.Element => {
    const sharedIcon = (
        <i
            data-testid='SharedChannelIcon'
            className={`${props.className || ''} icon-circle-multiple-outline`}
        />
    );

    if (!props.withTooltip) {
        return sharedIcon;
    }

    let sharedTooltipText;

    if (props.remoteNames && props.remoteNames.length > 0) {
        // If we have remote names, display them in the tooltip
        // Show first 3 remotes and then "and N others" if there are more
        const MAX_DISPLAY_NAMES = 3;
        const MAX_NAME_LENGTH = 30;
        const MAX_TOOLTIP_LENGTH = 120; // Maximum overall tooltip length

        // Truncate long organization names
        const truncatedNames = props.remoteNames.map((name) => (
            name.length > MAX_NAME_LENGTH ?
                `${name.substring(0, MAX_NAME_LENGTH)}...` :
                name
        ));

        if (truncatedNames.length <= MAX_DISPLAY_NAMES) {
            // If we have 3 or fewer organizations, just display them all separated by commas
            sharedTooltipText = (
                <FormattedMessage
                    id='shared_channel_indicator.tooltip_with_names.few'
                    defaultMessage='Shared with: {organizations}'
                    values={{
                        organizations: truncatedNames.join(', '),
                    }}
                />
            );
        } else {
            // If we have more than MAX_DISPLAY_NAMES organizations, show the first few and then "and N others"
            const displayNames = truncatedNames.slice(0, MAX_DISPLAY_NAMES);
            const remainingCount = truncatedNames.length - MAX_DISPLAY_NAMES;

            sharedTooltipText = (
                <FormattedMessage
                    id='shared_channel_indicator.tooltip_with_names.many'
                    defaultMessage='Shared with: {organizations} and {count, number} {count, plural, one {other} other {others}}'
                    values={{
                        organizations: displayNames.join(', '),
                        count: remainingCount,
                    }}
                />
            );
        }

        // Add a final truncation to enforce maximum tooltip length
        if (truncatedNames.join(', ').length > MAX_TOOLTIP_LENGTH) {
            const truncatedStr = truncatedNames.join(', ').substring(0, MAX_TOOLTIP_LENGTH - 3) + '...';
            sharedTooltipText = (
                <FormattedMessage
                    id='shared_channel_indicator.tooltip_with_names'
                    defaultMessage='Shared with: {remoteNames}'
                    values={{
                        remoteNames: truncatedStr,
                    }}
                />
            );
        }
    } else {
        // Fallback to generic message if no remote names are available
        sharedTooltipText = (
            <FormattedMessage
                id='shared_channel_indicator.tooltip'
                defaultMessage='Shared with trusted organizations'
            />
        );
    }

    return (
        <WithTooltip
            title={sharedTooltipText}
        >
            {sharedIcon}
        </WithTooltip>
    );
};

export default SharedChannelIndicator;
