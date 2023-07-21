// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    BellOutlineIcon,
    TrashCanOutlineIcon,
    PencilOutlineIcon,
    FormatListBulletedIcon,
    SortAlphabeticalAscendingIcon,
    ClockOutlineIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';

import {ChannelCategory, CategorySorting} from '@mattermost/types/channel_categories';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {trackEvent} from 'actions/telemetry_actions';

import {ModalIdentifiers} from 'utils/constants';

import DeleteCategoryModal from 'components/delete_category_modal';
import EditCategoryModal from 'components/edit_category_modal';
import * as Menu from 'components/menu';

import SidebarCategoryGenericMenu from './sidebar_category_generic_menu';
import MarkAsReadMenuItem from './mark_as_read_menu_item';
import CreateNewCategoryMenuItem from './create_new_category_menu_item';
import {useDispatch, useSelector} from 'react-redux';
import {shouldShowUnreadsCategory} from 'mattermost-redux/selectors/entities/preferences';
import {setCategoryMuted, setCategorySorting, viewCategory} from 'mattermost-redux/actions/channel_categories';

import {openModal} from 'actions/views/modals';

type Props = {
    category: ChannelCategory;
};

const SidebarCategoryMenu = ({
    category,
}: Props) => {
    const dispatch = useDispatch();
    const showUnreadsCategory = useSelector(shouldShowUnreadsCategory);

    const {formatMessage} = useIntl();

    let muteUnmuteCategoryMenuItem: JSX.Element | null = null;
    if (category.type !== CategoryTypes.DIRECT_MESSAGES) {
        function toggleCategoryMute() {
            dispatch(setCategoryMuted(category.id, !category.muted));
        }

        muteUnmuteCategoryMenuItem = (
            <Menu.Item
                id={`mute-${category.id}`}
                onClick={toggleCategoryMute}
                leadingElement={<BellOutlineIcon size={18}/>}
                labels={
                    category.muted ? (
                        <FormattedMessage
                            id='sidebar_left.sidebar_category_menu.unmuteCategory'
                            defaultMessage='Unmute Category'
                        />
                    ) : (
                        <FormattedMessage
                            id='sidebar_left.sidebar_category_menu.muteCategory'
                            defaultMessage='Mute Category'
                        />
                    )
                }
            />
        );
    }

    let deleteCategoryMenuItem: JSX.Element | null = null;
    let renameCategoryMenuItem: JSX.Element | null = null;
    if (category.type === CategoryTypes.CUSTOM) {
        function handleDeleteCategory() {
            dispatch(openModal({
                modalId: ModalIdentifiers.DELETE_CATEGORY,
                dialogType: DeleteCategoryModal,
                dialogProps: {
                    category,
                },
            }));
        }

        deleteCategoryMenuItem = (
            <Menu.Item
                id={`delete-${category.id}`}
                isDestructive={true}
                aria-haspopup={true}
                onClick={handleDeleteCategory}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_category_menu.deleteCategory'
                        defaultMessage='Delete Category'
                    />
                )}
            />
        );

        function handleRenameCategory() {
            dispatch(openModal({
                modalId: ModalIdentifiers.EDIT_CATEGORY,
                dialogType: EditCategoryModal,
                dialogProps: {
                    categoryId: category.id,
                    initialCategoryName: category.display_name,
                },
            }));
        }

        renameCategoryMenuItem = (
            <Menu.Item
                id={`rename-${category.id}`}
                onClick={handleRenameCategory}
                aria-haspopup={true}
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebar_left.sidebar_category_menu.renameCategory'
                        defaultMessage='Rename Category'
                    />
                )}
            />
        );
    }

    function handleSortChannels(sorting: CategorySorting) {
        dispatch(setCategorySorting(category.id, sorting));
        trackEvent('ui', `ui_sidebar_sort_dm_${sorting}`);
    }

    let sortChannelsSelectedValue = (
        <FormattedMessage
            id='sidebar.sortedManually'
            defaultMessage='Manually'
        />
    );
    let sortChannelsIcon = <FormatListBulletedIcon size={18}/>;
    if (category.sorting === CategorySorting.Alphabetical) {
        sortChannelsSelectedValue = (
            <FormattedMessage
                id='user.settings.sidebar.sortAlpha'
                defaultMessage='Alphabetically'
            />
        );
        sortChannelsIcon = <SortAlphabeticalAscendingIcon size={18}/>;
    } else if (category.sorting === CategorySorting.Recency) {
        sortChannelsSelectedValue = (
            <FormattedMessage
                id='user.settings.sidebar.recent'
                defaultMessage='Recent Activity'
            />
        );
        sortChannelsIcon = <ClockOutlineIcon size={18}/>;
    }

    const sortChannelsMenuItem = (
        <Menu.SubMenu
            id={`sortChannels-${category.id}`}
            leadingElement={sortChannelsIcon}
            labels={(
                <FormattedMessage
                    id='sidebar.sort'
                    defaultMessage='Sort'
                />
            )}
            trailingElements={(
                <>
                    {sortChannelsSelectedValue}
                    <ChevronRightIcon size={16}/>
                </>
            )}
            menuId={`sortChannels-${category.id}-menu`}
            menuAriaLabel={formatMessage({id: 'sidebar_left.sidebar_category_menu.sort.dropdownAriaLabel', defaultMessage: 'Sort submenu'})}
        >
            <Menu.Item
                id={`sortAplhabetical-${category.id}`}
                labels={(
                    <FormattedMessage
                        id='user.settings.sidebar.sortAlpha'
                        defaultMessage='Alphabetically'
                    />
                )}
                onClick={() => handleSortChannels(CategorySorting.Alphabetical)}
            />
            <Menu.Item
                id={`sortByMostRecent-${category.id}`}
                labels={(
                    <FormattedMessage
                        id='sidebar.sortedByRecencyLabel'
                        defaultMessage='Recent Activity'
                    />
                )}
                onClick={() => handleSortChannels(CategorySorting.Recency)}
            />
            <Menu.Item
                id={`sortManual-${category.id}`}
                labels={(
                    <FormattedMessage
                        id='sidebar.sortedManually'
                        defaultMessage='Manually'
                    />
                )}
                onClick={() => handleSortChannels(CategorySorting.Manual)}
            />
        </Menu.SubMenu>
    );

    function handleViewCategory() {
        dispatch(viewCategory(category.id, category.team_id));
        trackEvent('ui', 'ui_sidebar_category_menu_viewCategory');
    }

    const markAsReadMenuItem = showUnreadsCategory ?
        null :
        (
            <MarkAsReadMenuItem
                id={category.id}
                handleViewCategory={handleViewCategory}
            />
        );

    return (
        <SidebarCategoryGenericMenu id={category.id}>
            {markAsReadMenuItem}
            {markAsReadMenuItem && <Menu.Separator/>}
            {muteUnmuteCategoryMenuItem}
            {renameCategoryMenuItem}
            {deleteCategoryMenuItem}
            <Menu.Separator/>
            {sortChannelsMenuItem}
            <Menu.Separator/>
            <CreateNewCategoryMenuItem id={category.id}/>
        </SidebarCategoryGenericMenu>
    );
};

export default memo(SidebarCategoryMenu);
