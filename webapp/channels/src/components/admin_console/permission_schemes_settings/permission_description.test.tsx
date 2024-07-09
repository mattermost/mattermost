// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as reactRedux from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import PermissionDescription from './permission_description';

describe('components/admin_console/permission_schemes_settings/permission_description', () => {
    const defaultProps = {
        id: 'defaultID',
        selectRow: jest.fn(),
        description: 'This is the description',
    };

    let store = mockStore();
    beforeEach(() => {
        const initialState = {
            entities: {
                general: {
                    config: {},
                },
                users: {
                    currentUserId: 'currentUserId',
                },
            },
        };
        store = mockStore(initialState);
    });

    test('should match snapshot with default Props', () => {
        const wrapper = shallow(
            <PermissionDescription
                {...defaultProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if inherited', () => {
        const wrapper = shallow(
            <reactRedux.Provider store={store}>
                <PermissionDescription
                    {...defaultProps}
                    inherited={{
                        name: 'all_users',
                    }}
                />
            </reactRedux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with clickable link', () => {
        const description = (
            <span>{'This is a clickable description'}</span>
        );
        const wrapper = shallow(
            <PermissionDescription
                {...defaultProps}
                description={description}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should allow select with link', () => {
        const selectRow = jest.fn();

        const wrapper = mountWithIntl(
            <reactRedux.Provider store={store}>
                <PermissionDescription
                    {...defaultProps}
                    inherited={{
                        name: 'all_users',
                    }}
                    selectRow={selectRow}
                />
            </reactRedux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();

        const c = wrapper.find('.permission-description');
        console.log(c.text());
        console.log(c.childAt(0).text());
        console.log(c.children().first().text());
        wrapper.find('ExternalLink').children().first().simulate('click');
        expect(selectRow).toBeCalled();
    });
});
