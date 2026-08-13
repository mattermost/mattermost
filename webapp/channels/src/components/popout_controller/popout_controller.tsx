// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Route, Switch} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import {getMe} from 'mattermost-redux/actions/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {loadStatusesByIds} from 'actions/status_actions';

import ChannelPopout from 'components/channel_popout';
import HelpPopout from 'components/help_popout';
import LoggedIn from 'components/logged_in';
import ModalController from 'components/modal_controller';
import RhsPopout from 'components/rhs_popout';
import {useUserTheme} from 'components/theme_provider';
import ThreadPopout from 'components/thread_popout';

import Pluggable from 'plugins/pluggable';
import {TEAM_NAME_PATH_PATTERN, ID_PATH_PATTERN, IDENTIFIER_PATH_PATTERN} from 'utils/path';
import {useBrowserPopout} from 'utils/popouts/use_browser_popout';

import './popout_controller.scss';

const PopoutController: React.FC<RouteComponentProps> = (routeProps) => {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);

    useBrowserPopout();
    useUserTheme();

    useEffect(() => {
        document.body.classList.add('app__body', 'popout');
        dispatch(getMe());

        return () => {
            document.body.classList.remove('app__body', 'popout');
        };
    }, []);

    useEffect(() => {
        if (currentUserId) {
            dispatch(loadStatusesByIds([currentUserId]));
        }
    }, [dispatch, currentUserId]);

    return (
        <LoggedIn {...routeProps}>
            <ModalController/>
            <Pluggable pluggableName='Root'/>
            <Switch>
                <Route
                    path={`/_popout/thread/:team(${TEAM_NAME_PATH_PATTERN})/:postId(${ID_PATH_PATTERN})`}
                    component={ThreadPopout}
                />
                <Route
                    path={`/_popout/channel/:team(${TEAM_NAME_PATH_PATTERN})/:path(channels|messages)/:identifier(${IDENTIFIER_PATH_PATTERN})/:postid(${ID_PATH_PATTERN})?`}
                    component={ChannelPopout}
                />
                <Route
                    path={`/_popout/rhs/:team(${TEAM_NAME_PATH_PATTERN})`}
                    component={RhsPopout}
                />
                <Route
                    path='/_popout/help/:page?'
                    component={HelpPopout}
                />
            </Switch>
        </LoggedIn>
    );
};

export default PopoutController;
