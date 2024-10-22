// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {
    BellOutlineIcon,
    TrashCanOutlineIcon,
    PencilOutlineIcon,
    FormatListBulletedIcon,
    SortAlphabeticalAscendingIcon,
    ClockOutlineIcon,
    ChevronRightIcon,
    CheckIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelCategory} from '@mattermost/types/channel_categories';
import {CategorySorting} from '@mattermost/types/channel_categories';

import {setCategoryMuted, setCategorySorting} from 'mattermost-redux/actions/channel_categories';
import {readMultipleChannels} from 'mattermost-redux/actions/channels';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {shouldShowUnreadsCategory} from 'mattermost-redux/selectors/entities/preferences';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';
import {makeGetUnreadIdsForCategory} from 'selectors/views/channel_sidebar';

import DeleteCategoryModal from 'components/delete_category_modal';
import EditCategoryModal from 'components/edit_category_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import CreateNewCategoryMenuItem from './create_new_category_menu_item';
import MarkAsReadMenuItem from './mark_as_read_menu_item';
import SidebarCategoryGenericMenu from './sidebar_category_generic_menu';

type Props = {
    category: ChannelCategory;
};

const SidebarCategoryMenu = ({
    category,
}: Props) => {
    const dispatch = useDispatch();
    const showUnreadsCategory = useSelector(shouldShowUnreadsCategory);
    const getUnreadsIdsForCategory = useMemo(makeGetUnreadIdsForCategory, [category]);
    const unreadsIds = useSelector((state: GlobalState) => getUnreadsIdsForCategory(state, category));
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
                trailingElements={category.sorting === CategorySorting.Alphabetical ? <CheckIcon size={16}/> : null}
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
                trailingElements={category.sorting === CategorySorting.Recency ? <CheckIcon size={16}/> : null}
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
                trailingElements={category.sorting === CategorySorting.Manual ? <CheckIcon size={16}/> : null}
            />
        </Menu.SubMenu>
    );

    const handleViewCategory = useCallback(() => {
        dispatch(readMultipleChannels(unreadsIds));
        trackEvent('ui', 'ui_sidebar_category_menu_viewCategory');
    }, [dispatch, unreadsIds]);

    const markAsReadMenuItem = showUnreadsCategory ?
        null :
        (
            <MarkAsReadMenuItem
                id={category.id}
                handleViewCategory={handleViewCategory}
                numChannels={unreadsIds.length}
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
