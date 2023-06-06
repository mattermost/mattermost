// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {NavLink, useRouteMatch} from 'react-router-dom';
import {FormattedMessage} from 'react-intl';

import {localDraftsAreEnabled, syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getDrafts} from 'actions/views/drafts';

import {makeGetDraftsCount} from 'selectors/drafts';

import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';
import DraftsTourTip from 'components/drafts/drafts_link/drafts_tour_tip/drafts_tour_tip';

import './drafts_link.scss';

const getDraftsCount = makeGetDraftsCount();

function DraftsLink() {
    const dispatch = useDispatch();

    const localDraftsEnabled = useSelector(localDraftsAreEnabled);
    const syncedDraftsAllowedAndEnabled = useSelector(syncedDraftsAreAllowedAndEnabled);
    const count = useSelector(getDraftsCount);
    const teamId = useSelector(getCurrentTeamId);

    const {url} = useRouteMatch();
    const isDraftUrlMatch = useRouteMatch('/:team/drafts');

    useEffect(() => {
        if (syncedDraftsAllowedAndEnabled) {
            dispatch(getDrafts(teamId));
        }
    }, [teamId, syncedDraftsAllowedAndEnabled]);

    if (!localDraftsEnabled || (!count && !isDraftUrlMatch)) {
        return null;
    }

    console.log('DraftsLink.tsx: count = ' + count);

    return (
        <ul className='SidebarDrafts NavGroupContent nav nav-pills__container'>
            <li
                className='SidebarChannel'
                tabIndex={-1}
                id='sidebar-drafts-button'
            >
                <NavLink
                    to={`${url}/drafts`}
                    id='sidebarItem_drafts'
                    activeClassName='active'
                    draggable='false'
                    className='SidebarLink sidebar-item'
                    tabIndex={0}
                >
                    <i
                        data-testid='draftIcon'
                        className='icon icon-pencil-outline'
                    />
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            <FormattedMessage
                                id='drafts.sidebarTitle'
                                defaultMessage='Drafts'
                            />
                        </span>
                    </div>
                    {count > 0 && (
                        <ChannelMentionBadge unreadMentions={count}/>
                    )}
                </NavLink>
                <DraftsTourTip/>
            </li>
        </ul>
    );
}

export default memo(DraftsLink);
