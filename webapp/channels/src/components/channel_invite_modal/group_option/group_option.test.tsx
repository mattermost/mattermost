// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {Group} from '@mattermost/types/groups';

import store from 'stores/redux_store';

import type {Value} from 'components/multiselect/multiselect';

import GroupOption from './group_option';

const mockGroup = {
    id: 'group-id',
    display_name: 'Group Name',
    name: 'groupname',
    member_ids: ['user1', 'user2'],
    member_count: 2,
} as Group&Value;

describe('GroupOption', () => {
    let props: ComponentProps<typeof GroupOption>;

    beforeEach(() => {
        props = {
            group: mockGroup,
            isSelected: false,
            rowSelected: '',
            selectedItemRef: React.createRef(),
            onMouseMove: jest.fn(),
            addUserProfile: jest.fn(),
        };
    });

    test('should match snapshot', () => {
        const wrapper = render(
            <IntlProvider locale='en'>
                <Provider store={store}>
                    <GroupOption
                        {...props}
                    />
                </Provider>
            </IntlProvider>,

        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should render correctly', () => {
        const wrapper = render(
            <IntlProvider locale='en'>
                <Provider store={store}>
                    <GroupOption
                        {...props}
                    />
                </Provider>
            </IntlProvider>,

        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should cleanup keydown event listener on unmount', () => {
        const addUserProfileMock = jest.fn();
        const wrapper = render(
            <IntlProvider locale='en'>
                <Provider store={store}>
                    <GroupOption
                        group={mockGroup}
                        isSelected={false}
                        rowSelected=''
                        selectedItemRef={React.createRef()}
                        onMouseMove={() => {}}
                        addUserProfile={addUserProfileMock}
                    />
                </Provider>
            </IntlProvider>,

        );
        wrapper.unmount();
        const event = new KeyboardEvent('keydown', {key: 'Enter'});
        document.dispatchEvent(event);
        expect(addUserProfileMock).not.toHaveBeenCalled();
    });
});
