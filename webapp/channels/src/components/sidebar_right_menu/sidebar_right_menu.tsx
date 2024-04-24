// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {Link} from 'react-router-dom';
import {CSSTransition} from 'react-transition-group';

import MainMenu from 'components/main_menu';

import {Constants} from 'utils/constants';

import {TRANSITION_TIMEOUT} from './constant';

type Props = {
    isMobileView: boolean;
    isOpen: boolean;
    teamDisplayName?: string;
    siteName?: string;
};

const SidebarRightMenu = ({
    siteName: defaultSiteName,
    teamDisplayName: defaultTeamDisplayName,
    isOpen,
    isMobileView,
}: Props) => {
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
            className={classNames('sidebar--menu', {'move--left': isOpen && isMobileView})}
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
                    in={isOpen && isMobileView}
                    classNames='MobileRightSidebarMenu'
                    enter={true}
                    exit={true}
                    mountOnEnter={true}
                    unmountOnExit={true}
                    timeout={TRANSITION_TIMEOUT}
                >
                    <MainMenu mobile={true}/>
                </CSSTransition>
            </div>
        </div>
    );
};

export default memo(SidebarRightMenu);
