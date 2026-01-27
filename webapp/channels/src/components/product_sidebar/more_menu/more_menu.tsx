// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';
import React from 'react';
import {useIntl} from 'react-intl';

import * as Menu from 'components/menu';

import './more_menu.scss';

/**
 * MoreMenu displays the three-dot button and dropdown menu for overflow products
 * and system items. Uses Menu.Container positioned to the right of the sidebar.
 *
 * Content (ProductMenuItem items and system items) will be added in Plan 04-02.
 */
const MoreMenu = (): JSX.Element => {
    const {formatMessage} = useIntl();

    const tooltipText = formatMessage({
        id: 'product_sidebar.moreMenu.tooltip',
        defaultMessage: 'More options',
    });

    return (
        <div className='MoreMenu__wrapper'>
            <Menu.Container
                menuButton={{
                    id: 'productSidebarMoreMenuButton',
                    class: 'MoreMenuButton',
                    children: (
                        <DotsHorizontalIcon size={24}/>
                    ),
                }}
                menuButtonTooltip={{
                    text: tooltipText,
                    isVertical: false,
                }}
                menu={{
                    id: 'productSidebarMoreMenu',
                    'aria-label': formatMessage({
                        id: 'product_sidebar.moreMenu.ariaLabel',
                        defaultMessage: 'More menu',
                    }),
                    className: 'MoreMenu',
                }}
                anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                {/* Products group - content added in Plan 04-02 */}
                <Menu.Separator/>

                {/* System items group - content added in Plan 04-02 */}
            </Menu.Container>
        </div>
    );
};

export default MoreMenu;
