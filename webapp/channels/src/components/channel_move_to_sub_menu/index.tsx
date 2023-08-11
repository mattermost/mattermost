// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {
    FolderOutlineIcon,
    StarOutlineIcon,
    FolderMoveOutlineIcon,
    ChevronRightIcon,
    CheckIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getCategoryInTeamWithChannel} from 'mattermost-redux/selectors/entities/channel_categories';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions';
import {addChannelsInSidebar} from 'actions/views/channel_sidebar';
import {openModal} from 'actions/views/modals';
import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';

import EditCategoryModal from 'components/edit_category_modal';
import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';
import Constants, {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
    inHeaderDropdown?: boolean;
};

const ChannelMoveToSubMenu = (props: Props) => {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch<DispatchFunc>();

    const allChannels = useSelector(getAllChannels);
    const multiSelectedChannelIds = useSelector((state: GlobalState) => state.views.channelSidebar.multiSelectedChannelIds);

    const currentTeam = useSelector(getCurrentTeam);
    const categories = useSelector((state: GlobalState) => {
        return currentTeam ? getCategoriesForCurrentTeam(state) : undefined;
    });
    const currentCategory = useSelector((state: GlobalState) => {
        return currentTeam ? getCategoryInTeamWithChannel(state, currentTeam?.id || '', props.channel.id) : undefined;
    });

    function handleMoveToCategory(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>, categoryId: string) {
        event.preventDefault();

        if (currentCategory?.id !== categoryId) {
            dispatch(addChannelsInSidebar(categoryId, props.channel.id));
            trackEvent('ui', 'ui_sidebar_channel_menu_moveToExistingCategory');
        }
    }

    function handleMoveToNewCategory() {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CATEGORY,
            dialogType: EditCategoryModal,
            dialogProps: {
                channelIdsToAdd: multiSelectedChannelIds.indexOf(props.channel.id) === -1 ? [props.channel.id] : multiSelectedChannelIds,
            },
        }));
        trackEvent('ui', 'ui_sidebar_channel_menu_createCategory');
    }

    function createSubmenuItemsForCategoryArray(categories: ChannelCategory[], currentCategory?: ChannelCategory) {
        const allCategories = categories.map((category: ChannelCategory) => {
            let text = <span>{category.display_name}</span>;

            if (category.type === CategoryTypes.FAVORITES) {
                text = (
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.favorites'
                        defaultMessage='Favorites'
                    />
                );
            }
            if (category.type === CategoryTypes.CHANNELS) {
                text = (
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.channels'
                        defaultMessage='Channels'
                    />
                );
            }

            let selectedCategory = null;
            if (currentCategory && currentCategory.display_name === category.display_name) {
                selectedCategory = (
                    <CheckIcon
                        color='var(--button-bg)'
                        size={18}
                    />
                );
            }

            return (
                <Menu.Item
                    id={`moveToCategory-${props.channel.id}-${category.id}`}
                    key={`moveToCategory-${props.channel.id}-${category.id}`}
                    leadingElement={category.type === CategoryTypes.FAVORITES ? (<StarOutlineIcon size={18}/>) : (<FolderOutlineIcon size={18}/>)}
                    labels={text}
                    trailingElements={selectedCategory}
                    onClick={(event) => handleMoveToCategory(event, category.id)}
                />
            );
        });

        const dividerAndNewCategory = [
            <Menu.Separator key='ChannelMenu-moveToDivider'/>,
            <Menu.Item
                id={`moveToNewCategory-${props.channel.id}`}
                key={`moveToNewCategory-${props.channel.id}`}
                aria-haspopup={true}
                leadingElement={<FolderMoveOutlineIcon size={18}/>}
                labels={
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_menu.moveToNewCategory'
                        defaultMessage='New Category'
                    />
                }
                onClick={handleMoveToNewCategory}
            />,
        ];

        return [...allCategories, ...dividerAndNewCategory];
    }

    function filterCategoriesBasedOnChannelType(categories: ChannelCategory[], isDmOrGm = false) {
        if (isDmOrGm) {
            return categories.filter((category) => category.type !== CategoryTypes.CHANNELS);
        }

        return categories.filter((category) => category.type !== CategoryTypes.DIRECT_MESSAGES);
    }

    function getMoveToCategorySubmenuItems(categories: ChannelCategory[], currentCategory?: ChannelCategory) {
        const isSubmenuOneOfSelectedChannels = multiSelectedChannelIds.includes(props.channel.id);

        // If sub menu is in channel header dropdown OR If multiple channels are selected but the menu is open outside of those selected channels
        if (props.inHeaderDropdown || !isSubmenuOneOfSelectedChannels) {
            const isDmOrGm = props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL;
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, isDmOrGm);
            return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
        }

        const areAllSelectedChannelsDMorGM = multiSelectedChannelIds.every((channelId) => allChannels[channelId].type === Constants.DM_CHANNEL || allChannels[channelId].type === Constants.GM_CHANNEL);
        if (areAllSelectedChannelsDMorGM) {
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, true);
            return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
        }

        const areAllSelectedChannelsAreNotDMorGM = multiSelectedChannelIds.every((channelId) => allChannels[channelId].type !== Constants.DM_CHANNEL && allChannels[channelId].type !== Constants.GM_CHANNEL);
        if (areAllSelectedChannelsAreNotDMorGM) {
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, false);
            return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
        }

        // If we have a mix of channel types, we need to filter out both the DM and Channel categories
        const filteredCategories = categories.filter((category) => category.type !== CategoryTypes.CHANNELS && category.type !== CategoryTypes.DIRECT_MESSAGES);
        return createSubmenuItemsForCategoryArray(filteredCategories, currentCategory);
    }

    if (!categories) {
        return null;
    }

    return (
        <Menu.SubMenu
            id={`moveTo-${props.channel.id}`}
            labels={
                <FormattedMessage
                    id='sidebar_left.sidebar_channel_menu.moveTo'
                    defaultMessage='Move to...'
                />
            }
            leadingElement={props.inHeaderDropdown ? null : <FolderMoveOutlineIcon size={18}/>}
            trailingElements={<ChevronRightIcon size={16}/>}
            menuId={`moveTo-${props.channel.id}-menu`}
            menuAriaLabel={formatMessage({id: 'sidebar_left.sidebar_channel_menu.moveTo.dropdownAriaLabel', defaultMessage: 'Move to submenu'})}
        >
            {getMoveToCategorySubmenuItems(categories, currentCategory)}
        </Menu.SubMenu>
    );
};

export default memo(ChannelMoveToSubMenu);
