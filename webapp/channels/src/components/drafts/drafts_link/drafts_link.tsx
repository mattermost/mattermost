// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {NavLink, useRouteMatch} from 'react-router-dom';
import {useIntl} from 'react-intl';

import {localDraftsAreEnabled, syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getDrafts} from 'actions/views/drafts';
import {closeRightHandSide} from 'actions/views/rhs';

import {makeGetDraftsCount} from 'selectors/drafts';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';

import './drafts_link.scss';

import DraftsTourTip from './drafts_tour_tip/drafts_tour_tip';

const getDraftsCount = makeGetDraftsCount();

function DraftsLink() {
    const dispatch = useDispatch();
    const localDraftsEnabled = useSelector(localDraftsAreEnabled);
    const syncedDraftsAllowedAndEnabled = useSelector(syncedDraftsAreAllowedAndEnabled);
    const {formatMessage} = useIntl();
    const {url} = useRouteMatch();
    const match = useRouteMatch('/:team/drafts');
    const count = useSelector(getDraftsCount);
    const teamId = useSelector(getCurrentTeamId);
    const rhsOpen = useSelector(getIsRhsOpen);
    const rhsState = useSelector(getRhsState);

    useEffect(() => {
        if (syncedDraftsAllowedAndEnabled) {
            dispatch(getDrafts(teamId));
        }
    }, [teamId, dispatch, syncedDraftsAllowedAndEnabled]);

    const openDrafts = useCallback((e) => {
        e.stopPropagation();
        if (rhsOpen && rhsState === RHSStates.EDIT_HISTORY) {
            dispatch(closeRightHandSide());
        }
    }, [rhsOpen, rhsState]);

    if (!localDraftsEnabled || (!count && !match)) {
        return null;
    }

    return (
        <ul className='SidebarDrafts NavGroupContent nav nav-pills__container'>
            <li
                className='SidebarChannel'
                tabIndex={-1}
                id={'sidebar-drafts-button'}
            >
                <NavLink
                    onClick={openDrafts}
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
                            {formatMessage({id: 'drafts.sidebarLink', defaultMessage: 'Drafts'})}
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
