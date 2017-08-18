// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AddOAuthApp from 'components/integrations/components/add_oauth_app/add_oauth_app.jsx';

describe('components/integrations/AddOAuthApp', () => {
    const emptyFunction = jest.fn();
    const team = {
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test'
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AddOAuthApp
                team={team}
                addOAuthAppRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{addOAuthApp: emptyFunction}}
            />
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', () => {
        const wrapper = shallow(
            <AddOAuthApp
                team={team}
                addOAuthAppRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{addOAuthApp: emptyFunction}}
            />
        );

        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(wrapper).toMatchSnapshot();
    });

    test('should call addOAuthApp function', () => {
        const addOAuthApp = jest.genMockFunction().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve());
                });
            }
        );

        const wrapper = shallow(
            <AddOAuthApp
                team={team}
                addOAuthAppRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{addOAuthApp}}
            />
        );

        wrapper.find('#name').simulate('change', {target: {value: 'name'}});
        wrapper.find('#description').simulate('change', {target: {value: 'description'}});
        wrapper.find('#homepage').simulate('change', {target: {value: 'http://test.com'}});
        wrapper.find('#callbackUrls').simulate('change', {target: {value: 'http://callback.com'}});

        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(addOAuthApp).toBeCalled();
    });
});