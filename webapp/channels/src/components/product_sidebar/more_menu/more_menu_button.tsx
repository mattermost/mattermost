// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';

import './more_menu_button.scss';

interface MoreMenuButtonProps {
    active: boolean;
    onClick: (e: React.MouseEvent) => void;
}

/**
 * MoreMenuButton renders the three-dot icon button that opens the More menu.
 * Shows active state styling when the menu is open.
 */
const MoreMenuButton = ({active, onClick}: MoreMenuButtonProps): JSX.Element => {
    const {formatMessage} = useIntl();

    const ariaLabel = formatMessage({
        id: 'product_sidebar.moreMenu.button',
        defaultMessage: 'More options',
    });

    return (
        <button
            className={classNames('MoreMenuButton', {active})}
            onClick={onClick}
            aria-label={ariaLabel}
            aria-expanded={active}
            type='button'
        >
            <DotsHorizontalIcon size={24}/>
        </button>
    );
};

export default MoreMenuButton;
