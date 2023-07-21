// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    SortAlphabeticalAscendingIcon,
    ClockOutlineIcon,
    AccountMultipleOutlineIcon,
    AccountPlusOutlineIcon,
    DotsVerticalIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';
import {ChannelCategory, CategorySorting} from '@mattermost/types/channel_categories';
import classNames from 'classnames';
import React, {MouseEvent, memo, useState, KeyboardEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';
import {Preferences} from 'mattermost-redux/constants';

import * as Menu from 'components/menu';

import Constants from 'utils/constants';

import type {PropsFromRedux} from './index';

type OwnProps = {
    category: ChannelCategory;
    handleOpenDirectMessagesModal: (e: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;
};

type Props = OwnProps & PropsFromRedux;

const SidebarCategorySortingMenu = (props: Props) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const {formatMessage} = useIntl();

    function handleSortDirectMessages(sorting: CategorySorting) {
        props.setCategorySorting(props.category.id, sorting);
        trackEvent('ui', `ui_sidebar_sort_dm_${sorting}`);
    }

    let sortDirectMessagesIcon = <ClockOutlineIcon size={18}/>;
    let sortDirectMessagesSelectedValue = (
        <FormattedMessage
            id='user.settings.sidebar.recent'
            defaultMessage='Recent Activity'
        />
    );
    if (props.category.sorting === CategorySorting.Alphabetical) {
        sortDirectMessagesSelectedValue = (
            <FormattedMessage
                id='user.settings.sidebar.sortAlpha'
                defaultMessage='Alphabetically'
            />
        );
        sortDirectMessagesIcon = <SortAlphabeticalAscendingIcon size={18}/>;
    }

    const sortDirectMessagesMenuItem = (
        <Menu.SubMenu
            id={`sortDirectMessages-${props.category.id}`}
            leadingElement={sortDirectMessagesIcon}
            labels={(
                <FormattedMessage
                    id='sidebar.sort'
                    defaultMessage='Sort'
                />
            )}
            trailingElements={
                <>
                    {sortDirectMessagesSelectedValue}
                    <ChevronRightIcon size={16}/>
                </>
            }
            menuId={`sortDirectMessages-${props.category.id}-menu`}
        >
            <Menu.Item
                id={`sortAlphabetical-${props.category.id}`}
                labels={(
                    <FormattedMessage
                        id='user.settings.sidebar.sortAlpha'
                        defaultMessage='Alphabetically'
                    />
                )}
                onClick={() => handleSortDirectMessages(CategorySorting.Alphabetical)}
            />
            <Menu.Item
                id={`sortByMostRecent-${props.category.id}`}
                labels={(
                    <FormattedMessage
                        id='sidebar.sortedByRecencyLabel'
                        defaultMessage='Recent Activity'
                    />
                )}
                onClick={() => handleSortDirectMessages(CategorySorting.Recency)}
            />
        </Menu.SubMenu>

    );

    function handlelimitVisibleDMsGMs(number: number) {
        props.savePreferences(props.currentUserId, [{
            user_id: props.currentUserId,
            category: Constants.Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.LIMIT_VISIBLE_DMS_GMS,
            value: number.toString(),
        }]);
    }

    let showMessagesCountSelectedValue = <span>{props.selectedDmNumber}</span>;
    if (props.selectedDmNumber === 10000) {
        showMessagesCountSelectedValue = (
            <FormattedMessage
                id='channel_notifications.levels.all'
                defaultMessage='All'
            />
        );
    }

    const showMessagesCountMenuItem = (
        <Menu.SubMenu
            id={`showMessagesCount-${props.category.id}`}
            leadingElement={<AccountMultipleOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebar.show'
                    defaultMessage='Show'
                />
            )}
            trailingElements={(
                <>
                    {showMessagesCountSelectedValue}
                    <ChevronRightIcon size={16}/>
                </>
            )}
            menuId={`showMessagesCount-${props.category.id}-menu`}
        >
            <Menu.Item
                id={`showAllDms-${props.category.id}`}
                labels={(
                    <FormattedMessage
                        id='sidebar.allDirectMessages'
                        defaultMessage='All direct messages'
                    />
                )}
                onClick={() => handlelimitVisibleDMsGMs(Constants.HIGHEST_DM_SHOW_COUNT)}
            />
            <Menu.Separator/>
            {Constants.DM_AND_GM_SHOW_COUNTS.map((dmGmShowCount) => (
                <Menu.Item
                    id={`showDmCount-${props.category.id}-${dmGmShowCount}`}
                    key={`showDmCount-${props.category.id}-${dmGmShowCount}`}
                    labels={<span>{dmGmShowCount}</span>}
                    onClick={() => handlelimitVisibleDMsGMs(dmGmShowCount)}
                />
            ))}
        </Menu.SubMenu>

    );

    const openDirectMessageMenuItem = (
        <Menu.Item
            id={`openDirectMessage-${props.category.id}`}
            onClick={props.handleOpenDirectMessagesModal}
            leadingElement={<AccountPlusOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebar.openDirectMessage'
                    defaultMessage='Open a direct message'
                />
            )}
        />
    );

    function handleMenuToggle(isOpen: boolean) {
        setIsMenuOpen(isOpen);
    }

    return (
        <div
            className={classNames(
                'SidebarMenu',
                'MenuWrapper',
                {menuOpen: isMenuOpen},
                {'MenuWrapper--open': isMenuOpen},
            )}
        >
            <Menu.Container
                menuButton={{
                    id: `SidebarCategorySortingMenu-Button-${props.category.id}`,
                    'aria-label': formatMessage({id: 'sidebar_left.sidebar_category_menu.editCategory', defaultMessage: 'Category options'}),
                    class: 'SidebarMenu_menuButton sortingMenu',
                    children: <DotsVerticalIcon size={16}/>,
                }}
                menuButtonTooltip={{
                    id: `SidebarCategorySortingMenu-ButtonTooltip-${props.category.id}`,
                    text: formatMessage({id: 'sidebar_left.sidebar_category_menu.editCategory', defaultMessage: 'Category options'}),
                    class: 'hidden-xs',
                }}
                menu={{
                    id: `SidebarCategorySortingMenu-MenuList-${props.category.id}`,
                    'aria-label': formatMessage({id: 'sidebar_left.sidebar_category_menu.dropdownAriaLabel', defaultMessage: 'Edit category menu'}),
                    onToggle: handleMenuToggle,
                }}
            >
                {sortDirectMessagesMenuItem}
                {showMessagesCountMenuItem}
                <Menu.Separator/>
                {openDirectMessageMenuItem}
            </Menu.Container>
        </div>
    );
};

export default memo(SidebarCategorySortingMenu);
