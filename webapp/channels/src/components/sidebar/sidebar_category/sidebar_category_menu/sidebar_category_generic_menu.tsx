// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useState} from 'react';
import {useIntl} from 'react-intl';

import {
    DotsVerticalIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';

import * as Menu from 'components/menu';
import {SidebarMenuTrigger} from 'components/sidebar/sidebar_menu_trigger';

type Props = {
    id: string;
    children: React.ReactNode[];
    name: string;
};

const SidebarCategoryGenericMenu = ({
    id,
    children,
    name,
}: Props) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const {formatMessage} = useIntl();

    function handleMenuToggle(isOpen: boolean) {
        setIsMenuOpen(isOpen);
    }

    return (
        <div
            className={classNames(
                'SidebarMenu',
                'MenuWrapper',
                {
                    'MenuWrapper--open': isMenuOpen,
                    menuOpen: isMenuOpen,
                },
            )}
        >
            <Menu.Container
                menuButton={{
                    id: `SidebarCategoryMenu-Button-${id}`,
                    'aria-label': formatMessage({id: 'sidebar_left.sidebar_category_menu.editCategory', defaultMessage: '{name} category options'}, {name}),
                    as: SidebarMenuTrigger,
                    class: 'SidebarMenu_menuButton',
                    children: <Icon glyph={<DotsVerticalIcon/>}/>,
                }}
                menuButtonTooltip={{
                    text: formatMessage({id: 'sidebar_left.sidebar_category_menu.editCategory', defaultMessage: '{name} category options'}, {name}),
                    class: 'hidden-xs',
                }}
                menu={{
                    id: `SidebarChannelMenu-MenuList-${id}`,
                    'aria-label': formatMessage({id: 'sidebar_left.sidebar_category_menu.dropdownAriaLabel', defaultMessage: 'Edit category menu'}),
                    onToggle: handleMenuToggle,
                }}
            >
                {children}
            </Menu.Container>
        </div>
    );
};

export default memo(SidebarCategoryGenericMenu);
