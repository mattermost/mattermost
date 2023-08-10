// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Purpose of this file to exists is only required until channel header dropdown is migrated to new menus
import React, {memo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {
    FolderOutlineIcon,
    StarOutlineIcon,
    FolderMoveOutlineIcon,
} from '@mattermost/compass-icons/components';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getCategoryInTeamWithChannel} from 'mattermost-redux/selectors/entities/channel_categories';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {trackEvent} from 'actions/telemetry_actions';
import {addChannelsInSidebar} from 'actions/views/channel_sidebar';
import {openModal} from 'actions/views/modals';
import {getCategoriesForCurrentTeam} from 'selectors/views/channel_sidebar';

import EditCategoryModal from 'components/edit_category_modal';
import Menu from 'components/widgets/menu/menu';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';
import type {DispatchFunc} from 'mattermost-redux/types/actions';
import type {GlobalState} from 'types/store';
import type {Menu as MenuType} from 'types/store/plugins';

type Props = {
    channel: Channel;
    openUp: boolean;
    inHeaderDropdown?: boolean;
};

const ChannelMoveToSubMenuOld = (props: Props) => {
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

    function handleMoveToCategory(categoryId: string) {
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

    function createSubmenuItemsForCategoryArray(categories: ChannelCategory[]): MenuType[] {
        const allCategories = categories.map((category: ChannelCategory) => {
            let text = category.display_name;

            if (category.type === CategoryTypes.FAVORITES) {
                text = formatMessage({id: 'sidebar_left.sidebar_channel_menu.favorites', defaultMessage: 'Favorites'});
            }
            if (category.type === CategoryTypes.CHANNELS) {
                text = formatMessage({id: 'sidebar_left.sidebar_channel_menu.channels', defaultMessage: 'Channels'});
            }

            return {
                id: `moveToCategory-${props.channel.id}-${category.id}`,
                icon: category.type === CategoryTypes.FAVORITES ? (<StarOutlineIcon size={16}/>) : (<FolderOutlineIcon size={16}/>),
                direction: 'right',
                text,
                action: () => handleMoveToCategory(category.id),
            };
        });

        const dividerAndNewCategory = [
            {
                id: 'ChannelMenu-moveToDivider',
                text: (<span className='MenuGroup menu-divider'/>),
            },
            {
                id: `moveToNewCategory-${props.channel.id}`,
                icon: (<FolderMoveOutlineIcon size={16}/>),
                direction: 'right' as any,
                text: formatMessage({id: 'sidebar_left.sidebar_channel_menu.moveToNewCategory', defaultMessage: 'New Category'}),
                action: handleMoveToNewCategory,
            },
        ];

        return [...allCategories, ...dividerAndNewCategory];
    }

    function filterCategoriesBasedOnChannelType(categories: ChannelCategory[], isDmOrGm = false) {
        if (isDmOrGm) {
            return categories.filter((category) => category.type !== CategoryTypes.CHANNELS);
        }

        return categories.filter((category) => category.type !== CategoryTypes.DIRECT_MESSAGES);
    }

    function getMoveToCategorySubmenuItems(categories: ChannelCategory[]) {
        const isSubmenuOneOfSelectedChannels = multiSelectedChannelIds.includes(props.channel.id);

        // If sub menu is in channel header dropdown OR If multiple channels are selected but the menu is open outside of those selected channels
        if (props.inHeaderDropdown || !isSubmenuOneOfSelectedChannels) {
            const isDmOrGm = props.channel.type === Constants.DM_CHANNEL || props.channel.type === Constants.GM_CHANNEL;
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, isDmOrGm);
            return createSubmenuItemsForCategoryArray(filteredCategories);
        }

        const areAllSelectedChannelsDMorGM = multiSelectedChannelIds.every((channelId) => allChannels[channelId].type === Constants.DM_CHANNEL || allChannels[channelId].type === Constants.GM_CHANNEL);
        if (areAllSelectedChannelsDMorGM) {
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, true);
            return createSubmenuItemsForCategoryArray(filteredCategories);
        }

        const areAllSelectedChannelsAreNotDMorGM = multiSelectedChannelIds.every((channelId) => allChannels[channelId].type !== Constants.DM_CHANNEL && allChannels[channelId].type !== Constants.GM_CHANNEL);
        if (areAllSelectedChannelsAreNotDMorGM) {
            const filteredCategories = filterCategoriesBasedOnChannelType(categories, false);
            return createSubmenuItemsForCategoryArray(filteredCategories);
        }

        // If we have a mix of channel types, we need to filter out both the DM and Channel categories
        const filteredCategories = categories.filter((category) => category.type !== CategoryTypes.CHANNELS && category.type !== CategoryTypes.DIRECT_MESSAGES);
        return createSubmenuItemsForCategoryArray(filteredCategories);
    }

    if (!categories) {
        return null;
    }

    return (
        <Menu.Group>
            <Menu.ItemSubMenu
                id={`moveTo-${props.channel.id}`}
                subMenu={getMoveToCategorySubmenuItems(categories)}
                text={formatMessage({id: 'sidebar_left.sidebar_channel_menu.moveTo', defaultMessage: 'Move to...'})}
                direction={'right'}
                icon={props.inHeaderDropdown ? null : <FolderMoveOutlineIcon size={16}/>}
                openUp={props.openUp}
                styleSelectableItem={true}
                selectedValueText={currentCategory?.display_name}
                renderSelected={false}
            />
        </Menu.Group>
    );
};

export default memo(ChannelMoveToSubMenuOld);
