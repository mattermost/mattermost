// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';
import classNames from 'classnames';
import {CSSTransition} from 'react-transition-group';

import * as GlobalActions from 'actions/global_actions';
import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

import MainMenu from 'components/main_menu';

type Action = {
    openRhsMenu: () => void;
}

type Props = {
    isOpen: boolean;
    teamDisplayName?: string;
    siteName?: string;
    actions: Action;
};

const ANIMATION_DURATION = 500;

export default class SidebarRightMenu extends React.PureComponent<Props> {
    handleEmitUserLoggedOutEvent = () => {
        GlobalActions.emitUserLoggedOutEvent();
    };

    render() {
        let siteName = '';
        if (this.props.siteName != null) {
            siteName = this.props.siteName;
        }
        let teamDisplayName = siteName;
        if (this.props.teamDisplayName) {
            teamDisplayName = this.props.teamDisplayName;
        }

        return (
            <div
                className={classNames('sidebar--menu', {'move--left': this.props.isOpen && Utils.isMobile()})}
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
                        in={this.props.isOpen && Utils.isMobile()}
                        classNames='MobileRightSidebarMenu'
                        enter={true}
                        exit={true}
                        mountOnEnter={true}
                        unmountOnExit={true}
                        timeout={{
                            enter: ANIMATION_DURATION,
                            exit: ANIMATION_DURATION,
                        }}
                    >
                        <MainMenu mobile={true}/>
                    </CSSTransition>
                </div>
            </div>
        );
    }
}
