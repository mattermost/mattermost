// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Route, Switch, useRouteMatch} from 'react-router-dom';

import RhsPluginPopout from 'components/rhs_plugin_popout';
import UnreadsStatusHandler from 'components/unreads_status_handler';

import {TEAM_NAME_PATH_PATTERN} from 'utils/path';

import './rhs_popout.scss';

export default function RhsPopout() {
    const match = useRouteMatch();

    return (
        <>
            <UnreadsStatusHandler/>
            <div className='main-wrapper'>
                <div className='sidebar--right'>
                    <div className='sidebar-right__body'>
                        <Switch>
                            <Route
                                path={`${match.path}/plugin/:team(${TEAM_NAME_PATH_PATTERN})/:pluginId`}
                                component={RhsPluginPopout}
                            />
                        </Switch>
                    </div>
                </div>
            </div>
        </>
    );
}

