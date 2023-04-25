// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent, memo, useState, KeyboardEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import classNames from 'classnames';

import {
    SortAlphabeticalAscendingIcon,
    ClockOutlineIcon,
    AccountMultipleOutlineIcon,
    AccountPlusOutlineIcon,
    DotsVerticalIcon,
    ChevronRightIcon,
    ViewGridPlusOutlineIcon,
} from '@mattermost/compass-icons/components';

import {ChannelCategory, CategorySorting} from '@mattermost/types/channel_categories';

import {Preferences} from 'mattermost-redux/constants';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import Constants from 'utils/constants';

import {trackEvent} from 'actions/telemetry_actions';

import * as Menu from 'components/menu';

import type {PropsFromRedux} from './index';

type OwnProps = {
    category: ChannelCategory;
    handleCtaMenuItemOnClick?: (e: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;
};

type Props = OwnProps & PropsFromRedux;

const SidebarCategorySortingMenu = (props: Props) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const {formatMessage} = useIntl();

    const {id: categoryId, type: categoryType} = props.category;

    function handleSortDirectMessages(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>, sorting: CategorySorting) {
        event.preventDefault();

        props.setCategorySorting(categoryId, sorting);
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
            id={`sortDirectMessages-${categoryId}`}
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
            menuId={`sortDirectMessages-${categoryId}-menu`}
        >
            <Menu.Item
                id={`sortAlphabetical-${categoryId}`}
                labels={(
                    <FormattedMessage
                        id='user.settings.sidebar.sortAlpha'
                        defaultMessage='Alphabetically'
                    />
                )}
                onClick={(event) => handleSortDirectMessages(event, CategorySorting.Alphabetical)}
            />
            <Menu.Item
                id={`sortByMostRecent-${categoryId}`}
                labels={(
                    <FormattedMessage
                        id='sidebar.sortedByRecencyLabel'
                        defaultMessage='Recent Activity'
                    />
                )}
                onClick={(event) => handleSortDirectMessages(event, CategorySorting.Recency)}
            />
        </Menu.SubMenu>

    );

    function handlelimitVisibleDMsGMs(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>, number: number) {
        event.preventDefault();
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
            id={`showMessagesCount-${categoryId}`}
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
                id={`showAllDms-${categoryId}`}
                labels={(
                    <FormattedMessage
                        id='sidebar.allDirectMessages'
                        defaultMessage='All direct messages'
                    />
                )}
                onClick={(event) => handlelimitVisibleDMsGMs(event, Constants.HIGHEST_DM_SHOW_COUNT)}
            />
            <Menu.Separator/>
            {Constants.DM_AND_GM_SHOW_COUNTS.map((dmGmShowCount) => (
                <Menu.Item
                    id={`showDmCount-${categoryId}-${dmGmShowCount}`}
                    key={`showDmCount-${categoryId}-${dmGmShowCount}`}
                    labels={<span>{dmGmShowCount}</span>}
                    onClick={(event) => handlelimitVisibleDMsGMs(event, dmGmShowCount)}
                />
            ))}
        </Menu.SubMenu>

    );

    const ctaMenuItem = () => {
        if (!props.handleCtaMenuItemOnClick || (categoryType !== CategoryTypes.DIRECT_MESSAGES && categoryType !== CategoryTypes.APPS)) {
            return null;
        }

        let leadingElement = null;
        let label = null;

        if (categoryType === CategoryTypes.DIRECT_MESSAGES) {
            leadingElement = <AccountPlusOutlineIcon size={18}/>;
            label = (
                <FormattedMessage
                    id='sidebar.openDirectMessage'
                    defaultMessage='Open a direct message'
                />
            );
        } else {
            leadingElement = <ViewGridPlusOutlineIcon size={18}/>;
            label = (
                <FormattedMessage
                    id='sidebar.openAppMarketplace'
                    defaultMessage='App Marketplace'
                />
            );
        }

        return [
            <Menu.Separator key='SidebarCategorySortingMenu_separator'/>,
            <Menu.Item
                key={`ctaMenuItem-${categoryId}`}
                id={`ctaMenuItem-${categoryId}`}
                onClick={props.handleCtaMenuItemOnClick}
                leadingElement={leadingElement}
                labels={label}
            />,
        ];
    };

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
                    id: `SidebarCategorySortingMenu-Button-${categoryId}`,
                    'aria-label': formatMessage({id: 'sidebar_left.sidebar_category_menu.editCategory', defaultMessage: 'Category options'}),
                    class: 'SidebarMenu_menuButton sortingMenu',
                    children: <DotsVerticalIcon size={16}/>,
                }}
                menuButtonTooltip={{
                    id: `SidebarCategorySortingMenu-ButtonTooltip-${categoryId}`,
                    text: formatMessage({id: 'sidebar_left.sidebar_category_menu.editCategory', defaultMessage: 'Category options'}),
                    class: 'hidden-xs',
                }}
                menu={{
                    id: `SidebarCategorySortingMenu-MenuList-${categoryId}`,
                    'aria-label': formatMessage({id: 'sidebar_left.sidebar_category_menu.dropdownAriaLabel', defaultMessage: 'Edit category menu'}),
                    onToggle: handleMenuToggle,
                }}
            >
                {sortDirectMessagesMenuItem}
                {categoryType === CategoryTypes.DIRECT_MESSAGES && showMessagesCountMenuItem}
                {ctaMenuItem()}
            </Menu.Container>
        </div>
    );
};

export default memo(SidebarCategorySortingMenu);
