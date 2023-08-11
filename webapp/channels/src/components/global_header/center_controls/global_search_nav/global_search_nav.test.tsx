// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as redux from 'react-redux';

import {shallow} from 'enzyme';

import mockStore from 'tests/test_store';

import GlobalSearchNav from './global_search_nav';

describe('components/GlobalSearchNav', () => {
    const store = mockStore({});
    jest.spyOn(React, 'useEffect').mockImplementation(() => {});

    test('should match snapshot with active flagged posts', () => {
        const spy = jest.spyOn(redux, 'useSelector');

        spy.mockReturnValue({rhsState: 'flag'});
        spy.mockReturnValue({isRhsOpen: true});

        const wrapper = shallow(
            <redux.Provider store={store}>
                <GlobalSearchNav/>
            </redux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with active mentions posts', () => {
        const spy = jest.spyOn(redux, 'useSelector');

        spy.mockReturnValue({rhsState: 'mentions'});
        spy.mockReturnValue({isRhsOpen: 'true'});

        const wrapper = shallow(
            <redux.Provider store={store}>
                <GlobalSearchNav/>
            </redux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
