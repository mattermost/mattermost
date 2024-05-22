// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Route, Switch, Redirect} from 'react-router-dom';

import {makeAsyncComponent} from 'components/async_load';
import ChannelIdentifierRouter from 'components/channel_layout/channel_identifier_router';
import PlaybookRunner from 'components/channel_layout/playbook_runner';
import LoadingScreen from 'components/loading_screen';
import PermalinkView from 'components/permalink_view';

import {IDENTIFIER_PATH_PATTERN, ID_PATH_PATTERN, TEAM_NAME_PATH_PATTERN} from 'utils/path';

import type {OwnProps, PropsFromRedux} from './index';

const LazyChannelHeaderMobile = makeAsyncComponent(
    'LazyChannelHeaderMobile',
    React.lazy(() => import('components/channel_header_mobile')),
);

const LazyGlobalThreads = makeAsyncComponent(
    'LazyGlobalThreads',
    React.lazy(() => import('components/threading/global_threads')),
    (
        <div className='app__content'>
            <LoadingScreen/>
        </div>
    ),
);

const LazyDrafts = makeAsyncComponent(
    'LazyDrafts',
    React.lazy(() => import('components/drafts')),
    (
        <div className='app__content'>
            <LoadingScreen/>
        </div>
    ),
);

type Props = PropsFromRedux & OwnProps;

type State = {
    returnTo: string;
    lastReturnTo: string;
};

export default class CenterChannel extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            returnTo: '',
            lastReturnTo: '',
        };
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        if (prevState.lastReturnTo !== nextProps.location.pathname && nextProps.location.pathname.includes('/pl/')) {
            return {
                lastReturnTo: nextProps.location.pathname,
                returnTo: prevState.lastReturnTo,
            };
        }
        return {lastReturnTo: nextProps.location.pathname};
    }

    async componentDidMount() {
        const {actions} = this.props;
        await actions.getProfiles();
    }

    render() {
        const {lastChannelPath, isCollapsedThreadsEnabled, isMobileView} = this.props;
        const url = this.props.match.url;

        return (
            <div
                key='inner-wrap'
                className={classNames('inner-wrap', 'channel__wrap', {
                    'move--right': this.props.lhsOpen,
                    'move--left': this.props.rhsOpen,
                    'move--left-small': this.props.rhsMenuOpen,
                })}
            >
                {isMobileView && (
                    <div className='row header'>
                        <div id='navbar_wrapper'>
                            <LazyChannelHeaderMobile/>
                        </div>
                    </div>
                )}
                <div className='row main'>
                    <Switch>
                        <Route
                            path={`${url}/pl/:postid(${ID_PATH_PATTERN})`}
                            render={(props) => (
                                <PermalinkView
                                    {...props}
                                    returnTo={this.state.returnTo}
                                />
                            )}
                        />
                        <Route
                            path={`/:team(${TEAM_NAME_PATH_PATTERN})/:path(channels|messages)/:identifier(${IDENTIFIER_PATH_PATTERN})/:postid(${ID_PATH_PATTERN})?`}
                            component={ChannelIdentifierRouter}
                        />
                        <Route
                            path={`/:team(${TEAM_NAME_PATH_PATTERN})/_playbooks/:playbookId(${ID_PATH_PATTERN})/run`}
                        >
                            <PlaybookRunner/>
                        </Route>
                        {isCollapsedThreadsEnabled ? (
                            <Route
                                path={`/:team(${TEAM_NAME_PATH_PATTERN})/threads/:threadIdentifier(${ID_PATH_PATTERN})?`}
                                component={LazyGlobalThreads}
                            />
                        ) : null}
                        <Route
                            path={`/:team(${TEAM_NAME_PATH_PATTERN})/drafts`}
                            component={LazyDrafts}
                        />

                        <Redirect to={lastChannelPath}/>
                    </Switch>
                </div>
            </div>
        );
    }
}
