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
        let remoteNamesText;

        // Truncate long organization names
        const truncatedNames = props.remoteNames.map((name) => (
            name.length > MAX_NAME_LENGTH ?
                `${name.substring(0, MAX_NAME_LENGTH)}...` :
                name
        ));

        if (truncatedNames.length <= MAX_DISPLAY_NAMES) {
            remoteNamesText = truncatedNames.join(', ');
        } else {
            const displayNames = truncatedNames.slice(0, MAX_DISPLAY_NAMES);
            const remainingCount = truncatedNames.length - MAX_DISPLAY_NAMES;
            remoteNamesText = `${displayNames.join(', ')} and ${remainingCount} other${remainingCount > 1 ? 's' : ''}`;
        }

        sharedTooltipText = (
            <FormattedMessage
                id='shared_channel_indicator.tooltip_with_names'
                defaultMessage='Shared with: {remoteNames}'
                values={{
                    remoteNames: remoteNamesText,
                }}
            />
        );
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
