// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as redux from 'react-redux';

import mockStore from 'tests/test_store';

import Insights from './insights';

describe('components/activity_and_insights/insights', () => {
    const store = mockStore({});

    test('should match snapshot', () => {
        const wrapper = shallow(
            <redux.Provider store={store}>
                <Insights/>
            </redux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
