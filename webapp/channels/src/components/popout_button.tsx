// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {DockWindowIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {canPopout} from 'utils/popouts/popout_windows';

type Props = {
    onClick: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
    size?: React.ComponentProps<typeof IconButton>['size'];
};

export default function PopoutButton({
    onClick,
    className,
    size = 'small',
}: Props) {
    const intl = useIntl();

    if (!canPopout()) {
        return null;
    }

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='new_window_button.tooltip'
                    defaultMessage='Open in new window'
                />
            }
        >
            <IconButton
                size={size}
                className={classNames('PopoutButton', className)}
                icon={<Icon glyph={<DockWindowIcon/>}/>}
                aria-label={intl.formatMessage({id: 'new_window_button.tooltip', defaultMessage: 'Open in new window'})}
                onClick={onClick}
            />
        </WithTooltip>
    );
}
