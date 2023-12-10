// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {hot} from 'react-hot-loader/root';
import {Provider} from 'react-redux';
import {Router, Route} from 'react-router-dom';

import store from 'stores/redux_store';

import {makeAsyncComponent} from 'components/async_load';
import CRTPostsChannelResetWatcher from 'components/threading/channel_threads/posts_channel_reset_watcher';

import {getHistory} from 'utils/browser_history';
const LazyRoot = React.lazy(() => import('components/root'));

const Root = makeAsyncComponent('Root', LazyRoot);

const App = () => {
    return (
        <Provider store={store}>
            <CRTPostsChannelResetWatcher/>
            <Router history={getHistory()}>
                <Route
                    path='/'
                    component={Root}
                />
            </Router>
        </Provider>
    );
};

export default hot(React.memo(App));
