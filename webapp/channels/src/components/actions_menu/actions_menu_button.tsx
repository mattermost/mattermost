// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

type ActionsMenuButtonProps = {
    buttonId: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    isMenuOpen: boolean;
    popupId: string;
};

const ActionsMenuButton = React.forwardRef<HTMLButtonElement, ActionsMenuButtonProps>(({
    buttonId,
    onClick,
    isMenuOpen,
    popupId,
}, ref) => {
    const {formatMessage} = useIntl();

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='post_info.tooltip.actions'
                    defaultMessage='Message actions'
                />
            }
        >
            <button
                key='more-actions-button'
                ref={ref}
                id={buttonId}
                aria-label={formatMessage({id: 'post_info.actions.tooltip.actions', defaultMessage: 'Actions'}).toLowerCase()}
                className={classNames('post-menu__item', {
                    'post-menu__item--active': isMenuOpen,
                })}
                type='button'
                aria-controls={popupId}
                aria-expanded={isMenuOpen}
                aria-haspopup={true}
                onClick={onClick}
            >
                <i className={'icon icon-apps'}/>
            </button>
        </WithTooltip>
    );
});
ActionsMenuButton.displayName = 'ActionsMenuButton';

export default ActionsMenuButton;
