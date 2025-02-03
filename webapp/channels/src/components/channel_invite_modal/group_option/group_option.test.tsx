// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';

import type {Value} from 'components/multiselect/multiselect';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';

import GroupOption from './group_option';
import type{Props} from './group_option';

const mockGroup = {
    id: 'group-id',
    display_name: 'Group Name',
    name: 'groupname',
    member_ids: ['user1', 'user2'],
    member_count: 2,
} as Group&Value;

describe('GroupOption', () => {
    const props: Props = {
        group: mockGroup,
        isSelected: false,
        rowSelected: '',
        selectedItemRef: React.createRef(),
        onMouseMove: jest.fn(),
        addUserProfile: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = renderWithContext(
            <GroupOption
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should cleanup keydown event listener on unmount', () => {
        const addUserProfileMock = jest.fn();
        const wrapper = renderWithContext(
            <GroupOption
                group={mockGroup}
                isSelected={false}
                rowSelected=''
                selectedItemRef={React.createRef()}
                onMouseMove={() => {}}
                addUserProfile={addUserProfileMock}
            />,
        );
        wrapper.unmount();
        const event = new KeyboardEvent('keydown', {key: 'Enter'});
        document.dispatchEvent(event);
        expect(addUserProfileMock).not.toHaveBeenCalled();
    });

    it('should cleanup keydown event listener on unmount and dispatch event correctly before unmount', () => {
        const addUserProfileMock = jest.fn();
        props.isSelected = true;

        const wrapper = renderWithContext(
            <GroupOption
                {...props}
                addUserProfile={addUserProfileMock}
            />,
        );

        const event = new KeyboardEvent('keydown', {key: 'Enter'});
        document.dispatchEvent(event);

        waitFor(() => {
            expect(addUserProfileMock).toHaveBeenCalled();
        });

        wrapper.unmount();

        document.dispatchEvent(event);

        waitFor(() => {
            expect(addUserProfileMock).toHaveBeenCalledTimes(1);
        });
    });
});
