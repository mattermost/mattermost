// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {CSSTransition} from 'react-transition-group';

import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';

import MobileRightDrawerItems from './mobile_sidebar_right_items';

import type {PropsFromRedux} from './index';
import './mobile_sidebar_right.scss';

const TRANSITION_TIMEOUT = 300; // in ms

type Props = PropsFromRedux;

const MobileRightDrawer = ({
    isOpen,
    currentUser,
}: Props) => {
    const usageDeltas = useGetUsageDeltas();

    if (!currentUser) {
        return null;
    }

    return (
        <div
            className={classNames('sidebar--menu', {'move--left': isOpen})}
            id='sidebar-menu'
        >
            <div className='nav-pills__container mobile-main-menu'>
                <CSSTransition
                    in={isOpen}
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
