// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';

import {mark} from 'actions/telemetry_actions';
import {clearChannelSelection} from 'actions/views/channel_sidebar';
import {closeRightHandSide} from 'actions/views/rhs';
import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';
import {Mark} from 'utils/performance_telemetry';

import {getChannelSidebarSubItemLink} from './use_channel_sidebar_sub_items';

type Props = {
    id: string;
    channel: Channel;
    currentTeamName: string;
    items: ResolvedChannelSidebarSubItem[];
    activeKey?: string;
};

export default function SidebarChannelSubItems({id, channel, currentTeamName, items, activeKey}: Props) {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const rhsOpen = useSelector(getIsRhsOpen);

    const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented || event.button !== 0) {
            return;
        }

        mark(Mark.ChannelLinkClicked);
        dispatch(clearChannelSelection());

        if (rhsOpen && rhsState === RHSStates.EDIT_HISTORY) {
            dispatch(closeRightHandSide());
        }
    }, [dispatch, rhsOpen, rhsState]);

    return (
        <ul
            id={id}
            role='list'
            className='SidebarChannelSubItems'
        >
            {items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                    <li
                        key={item.key}
                        className={classNames('SidebarChannelSubItem', {active: isActive})}
                    >
                        <Link
                            className='SidebarChannelSubItem__link'
                            to={getChannelSidebarSubItemLink(currentTeamName, channel.name, item.subpath)}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={handleClick}
                        >
                            {item.iconName && (
                                <i
                                    className={`icon icon-${item.iconName} SidebarChannelSubItem__icon`}
                                    aria-hidden='true'
                                />
                            )}
                            <span className='SidebarChannelSubItem__label'>{item.label}</span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
