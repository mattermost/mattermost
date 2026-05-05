// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {NavLink, useRouteMatch} from 'react-router-dom';

import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';

import type {GlobalState} from 'types/store';

import './activity_link.scss';

const ActivityLink = () => {
    const {formatMessage} = useIntl();
    const {url} = useRouteMatch();
    const unreadCount = useSelector((state: GlobalState) => ((state.views as any).activity?.unreadPostIds as Array<{postId: string; channelId: string}> | undefined)?.length ?? 0);

    return (
        <ul className='SidebarActivity NavGroupContent nav nav-pills__container'>
            <li
                id='sidebar-activity-button'
                className={classNames('SidebarChannel', {unread: unreadCount > 0})}
                tabIndex={-1}
            >
                <NavLink
                    to={`${url}/activity`}
                    id='sidebarItem_activity'
                    activeClassName='active'
                    draggable='false'
                    className={classNames('SidebarLink sidebar-item', {'unread-title': unreadCount > 0})}
                    tabIndex={0}
                >
                    <i className='icon icon-bell-outline'/>
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            {formatMessage({id: 'activity.sidebarLink', defaultMessage: 'Activity'})}
                        </span>
                    </div>
                    {unreadCount > 0 && (
                        <ChannelMentionBadge unreadMentions={unreadCount}/>
                    )}
                </NavLink>
            </li>
        </ul>
    );
};

export default ActivityLink;
