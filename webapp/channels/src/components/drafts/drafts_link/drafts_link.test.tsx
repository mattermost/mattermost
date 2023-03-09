// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import DraftsLink from './drafts_link';

describe('components/drafts/drafts_link', () => {
    it('should match snapshot', () => {
        const store = mockStore();

        const wrapper = shallow(
            <Provider store={store}>
                <DraftsLink/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
