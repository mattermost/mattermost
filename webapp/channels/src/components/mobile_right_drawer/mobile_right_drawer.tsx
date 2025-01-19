// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {Link} from 'react-router-dom';
import {CSSTransition} from 'react-transition-group';

import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';

import {Constants} from 'utils/constants';

import MobileRightDrawerItems from './mobile_right_drawer_items';

import type {PropsFromRedux} from './index';

const TRANSITION_TIMEOUT = 500; // in ms

type Props = PropsFromRedux;

const MobileRightDrawer = ({
    siteName: defaultSiteName,
    teamDisplayName: defaultTeamDisplayName,
    isOpen,
    currentUser,
}: Props) => {
    const usageDeltas = useGetUsageDeltas();

    if (!currentUser) {
        return null;
    }

    let siteName = '';
    if (defaultSiteName != null) {
        siteName = defaultSiteName;
    }
    let teamDisplayName = siteName;
    if (defaultTeamDisplayName) {
        teamDisplayName = defaultTeamDisplayName;
    }

    return (
        <div
            className={classNames('sidebar--menu', {'move--left': isOpen})}
            id='sidebar-menu'
        >
            <div className='team__header theme'>
                <Link
                    className='team__name'
                    to={`/channels/${Constants.DEFAULT_CHANNEL}`}
                >
                    {teamDisplayName}
                </Link>
            </div>
            <div className='nav-pills__container mobile-main-menu'>
                <CSSTransition
                    in={isOpen}
                    classNames='MobileRightSidebarMenu'
                    enter={true}
                    exit={true}
                    mountOnEnter={true}
                    unmountOnExit={true}
                    timeout={TRANSITION_TIMEOUT}
                >
                    <MobileRightDrawerItems
                        usageDeltaTeams={usageDeltas.teams.active}
                    />
                </CSSTransition>
            </div>
        </div>
    );
};

export default memo(MobileRightDrawer);
