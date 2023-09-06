// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import AddBot from './add_bot';

describe('components/integrations/bots/AddBot', () => {
    const team = TestHelper.getTeamMock();

    const actions = {
        createBot: jest.fn(),
        patchBot: jest.fn(),
        uploadProfileImage: jest.fn(),
        setDefaultProfileImage: jest.fn(),
        createUserAccessToken: jest.fn(),
        updateUserRoles: jest.fn(),
    };

    it('blank', () => {
        const wrapper = shallow(
            <AddBot
                maxFileSize={100}
                team={team}
                editingUserHasManageSystem={true}
                actions={actions}
            />,
        );
        expect(wrapper.containsMatchingElement(
            <input
                id='username'
                value={''}
            />,
        )).toEqual(true);
        expect(wrapper.containsMatchingElement(
            <input
                id='displayName'
                value={''}
            />,
        )).toEqual(true);
        expect(wrapper.containsMatchingElement(
            <input
                id='description'
                value={''}
            />,
        )).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    it('edit bot', () => {
        const bot = TestHelper.getBotMock({});
        const wrapper = shallow(
            <AddBot
                bot={bot}
                maxFileSize={100}
                team={team}
                editingUserHasManageSystem={true}
                actions={actions}
            />,
        );
        expect(wrapper.containsMatchingElement(
            <input
                id='username'
                value={bot.username}
            />,
        )).toEqual(true);
        expect(wrapper.containsMatchingElement(
            <input
                id='displayName'
                value={bot.display_name}
            />,
        )).toEqual(true);
        expect(wrapper.containsMatchingElement(
            <input
                id='description'
                value={bot.description}
            />,
        )).toEqual(true);
    });
});
