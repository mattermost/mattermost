// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General} from 'mattermost-redux/constants';

import {render, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AtMention from './at_mention';

describe('components/AtMention', () => {
    const baseProps = {
        currentUserId: 'abc1',
        teammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
        usersByUsername: {
            currentuser: TestHelper.getUserMock(
                {id: 'abc1', username: 'currentuser', first_name: 'First', last_name: 'Last'},
            ),
            user1: TestHelper.getUserMock({id: 'abc2', username: 'user1', first_name: 'Other', last_name: 'User', nickname: 'Nick'}),
            'userdot.': TestHelper.getUserMock({id: 'abc3', username: 'userdot.', first_name: 'Dot', last_name: 'Matrix'}),
        },
        groupsByName: {
            developers: TestHelper.getGroupMock({id: 'qwerty1', name: 'developers', allow_reference: true}),
            marketing: TestHelper.getGroupMock({id: 'qwerty2', name: 'marketing', allow_reference: false}),
            accounting: TestHelper.getGroupMock({id: 'qwerty3', name: 'accounting', allow_reference: true}),
        },
        getMissingMentionedUsers: jest.fn(),
    };

    test('should render the mention as a non-submit button', () => {
        render(
            <AtMention
                {...baseProps}
                mentionName='user1'
            >
                {'(at)-user1'}
            </AtMention>,
        );

        expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    describe('fetchMissingUsers', () => {
        test('when fetchMissingUsers is true, should fetch an unloaded user on mount', () => {
            render(
                <AtMention
                    {...baseProps}
                    mentionName='someuser'
                    fetchMissingUsers={true}
                >
                    {'@someuser'}
                </AtMention>,
            );

            expect(baseProps.getMissingMentionedUsers).toHaveBeenCalledWith('someuser');
        });

        test('when fetchMissingUsers is false, should not fetch an unloaded user on mount', () => {
            render(
                <AtMention
                    {...baseProps}
                    mentionName='someuser'
                    fetchMissingUsers={false}
                >
                    {'@someuser'}
                </AtMention>,
            );

            expect(baseProps.getMissingMentionedUsers).not.toHaveBeenCalledWith('someuser');
        });
    });
});
