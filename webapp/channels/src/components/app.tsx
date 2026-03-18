// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy} from 'react';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';

import store from 'stores/redux_store';

import {makeAsyncComponent} from 'components/async_load';

import {getHistory} from 'utils/browser_history';
const LazyRoot = lazy(() => import('components/root'));

const Root = makeAsyncComponent('Root', LazyRoot);

const App = () => {
    return (
        <Provider store={store}>
            <Router history={getHistory()}>
                <Root/>
            </Router>
        </Provider>
    );
};

export default React.memo(App);
