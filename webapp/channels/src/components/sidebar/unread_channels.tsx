// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {SidebarCategoryHeaderStatic} from './sidebar_category_header';
import SidebarChannel from './sidebar_channel';
import SidebarCategoryGenericMenu from './sidebar_category/sidebar_category_menu/sidebar_category_generic_menu';
import MarkAsReadMenuItem from './sidebar_category/sidebar_category_menu/mark_as_read_menu_item';
import * as Menu from 'components/menu';
import CreateNewCategoryMenuItem from './sidebar_category/sidebar_category_menu/create_new_category_menu_item';
import {trackEvent} from 'actions/telemetry_actions';
import {useDispatch, useSelector} from 'react-redux';
import {getUnreadChannels} from 'selectors/views/channel_sidebar';
import {readMultipleChannels} from 'mattermost-redux/actions/channels';

type Props = {
    setChannelRef: (channelId: string, ref: HTMLLIElement) => void;
};

export default function UnreadChannels({
    setChannelRef,
}: Props) {
    const intl = useIntl();
    const unreadChannels = useSelector(getUnreadChannels);
    const dispatch = useDispatch();

    const handleViewCategory = useCallback(() => {
        if (!unreadChannels.length) {
            return;
        }

        dispatch(readMultipleChannels(unreadChannels.map((v) => v.id)));
        trackEvent('ui', 'ui_sidebar_category_menu_viewUnreadCategory');
    }, [unreadChannels, dispatch]);

    if (unreadChannels.length === 0) {
        return null;
    }

    return (
        <div className='SidebarChannelGroup dropDisabled a11y__section'>
            <SidebarCategoryHeaderStatic displayName={intl.formatMessage({id: 'sidebar.types.unreads', defaultMessage: 'UNREADS'})}>
                <SidebarCategoryGenericMenu id='unreads'>
                    <MarkAsReadMenuItem
                        id={'unreads'}
                        handleViewCategory={handleViewCategory}
                        numChannels={unreadChannels.length}
                    />
                    <Menu.Separator/>
                    <CreateNewCategoryMenuItem id={'unreads'}/>
                </SidebarCategoryGenericMenu>
            </SidebarCategoryHeaderStatic>
            <div className='SidebarChannelGroup_content'>
                <ul
                    role='list'
                    className='NavGroupContent'
                >
                    {unreadChannels.map((channel, index) => {
                        return (
                            <SidebarChannel
                                key={channel.id}
                                channelIndex={index}
                                channelId={channel.id}
                                setChannelRef={setChannelRef}
                                isCategoryCollapsed={false}
                                isCategoryDragged={false}
                                isDraggable={false}
                                isAutoSortedCategory={true}
                            />
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
