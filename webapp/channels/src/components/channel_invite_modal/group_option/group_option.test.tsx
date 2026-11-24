// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';

import type {Value} from 'components/multiselect/multiselect';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GroupOption from './group_option';
import type {Props} from './group_option';

const mockGroup = {
    id: 'group-id',
    display_name: 'Group Name',
    name: 'groupname',
    member_ids: ['user1', 'user2'],
    member_count: 2,
} as Group & Value;

describe('GroupOption', () => {
    const props: Props = {
        group: mockGroup,
        isSelected: false,
        rowSelected: '',
        selectedItemRef: React.createRef(),
        onMouseMove: jest.fn(),
        addUserProfile: jest.fn(),
    };

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

    describe('member tooltip', () => {
        const emptyGroup = {...mockGroup, member_ids: [], member_count: 0} as Group & Value;

        it('should show a default message when the group has no members', async () => {
            renderWithContext(
                <GroupOption
                    {...props}
                    group={emptyGroup}
                />,
            );

            await userEvent.hover(screen.getByText('Add 0 people'));

            expect(await screen.findByRole('tooltip')).toHaveTextContent('This group has no members');
        });

        it('should list the member names when the group has members', async () => {
            const state = {
                entities: {
                    users: {
                        profiles: {
                            user1: TestHelper.getUserMock({id: 'user1', username: 'alice'}),
                            user2: TestHelper.getUserMock({id: 'user2', username: 'bob'}),
                        },
                    },
                },
            };

            renderWithContext(
                <GroupOption {...props}/>,
                state,
            );

            await userEvent.hover(screen.getByText('Add 2 people'));

            expect(await screen.findByRole('tooltip')).toHaveTextContent('alice, bob');
        });
    });
});
