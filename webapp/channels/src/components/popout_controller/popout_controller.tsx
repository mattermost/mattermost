// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import {Route, Switch} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import {getProfiles} from 'mattermost-redux/actions/users';

import LoggedIn from 'components/logged_in';
import ModalController from 'components/modal_controller';
import ThreadPopout from 'components/thread_popout';

import {TEAM_NAME_PATH_PATTERN, ID_PATH_PATTERN} from 'utils/path';
import {useBrowserPopout} from 'utils/popouts/use_browser_popout';

import './popout_controller.scss';

const PopoutController: React.FC<RouteComponentProps> = (routeProps) => {
    const dispatch = useDispatch();
    useBrowserPopout();
    useEffect(() => {
        document.body.classList.add('app__body', 'popout');
        dispatch(getProfiles());
    }, []);

    return (
        <LoggedIn {...routeProps}>
            <ModalController/>
            <Switch>
                <Route
                    path={`/_popout/thread/:team(${TEAM_NAME_PATH_PATTERN})/:postId(${ID_PATH_PATTERN})`}
                    component={ThreadPopout}
                />
            </Switch>
        </LoggedIn>
    );
};

export default PopoutController;
