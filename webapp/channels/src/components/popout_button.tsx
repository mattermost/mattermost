// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import DesktopApp from 'utils/desktop_api';

type Props = {
    onClick: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
};

export default function PopoutButton({
    onClick,
    className,
}: Props) {
    const intl = useIntl();

    if (!DesktopApp.canPopout()) {
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
            <button
                type='button'
                className={classNames('btn btn-icon btn-sm', 'PopoutButton', className)}
                aria-label={intl.formatMessage({id: 'new_window_button.tooltip', defaultMessage: 'Open in new window'})}
                onClick={onClick}
            >
                <i
                    className='icon icon-dock-window'
                    aria-hidden='true'
                />
            </button>
        </WithTooltip>
    );
}
