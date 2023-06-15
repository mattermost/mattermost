// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import DotMenu from 'components/dot_menu/dot_menu';
import {TestHelper} from 'utils/test_helper';

jest.mock('utils/utils', () => {
    return {
        localizeMessage: jest.fn().mockReturnValue(''),
    };
});

jest.mock('utils/post_utils', () => {
    const original = jest.requireActual('utils/post_utils');
    return {
        ...original,
        isSystemMessage: jest.fn(() => true),
    };
});

describe('components/dot_menu/DotMenu returning empty ("")', () => {
    test('should match snapshot, return empty ("") on Center', () => {
        const baseProps = {
            post: TestHelper.getPostMock({id: 'post_id_1'}),
            isLicensed: false,
            postEditTimeLimit: '-1',
            handleCommentClick: jest.fn(),
            handleDropdownOpened: jest.fn(),
            enableEmojiPicker: true,
            components: {},
            channelIsArchived: false,
            currentTeamUrl: '',
            actions: {
                flagPost: jest.fn(),
                unflagPost: jest.fn(),
                setEditingPost: jest.fn(),
                pinPost: jest.fn(),
                unpinPost: jest.fn(),
                openModal: jest.fn(),
                markPostAsUnread: jest.fn(),
                handleBindingClick: jest.fn(),
                postEphemeralCallResponseForPost: jest.fn(),
                setThreadFollow: jest.fn(),
                addPostReminder: jest.fn(),
                setGlobalItem: jest.fn(),
            },
            canEdit: false,
            canDelete: false,
            appBindings: [],
            pluginMenuItems: [],
            appsEnabled: false,
            isMobileView: false,
            isReadOnly: false,
            isCollapsedThreadsEnabled: false,
            teamId: '',
            threadId: 'post_id_1',
            userId: 'user_id_1',
            isMilitaryTime: false,
            canAddReaction: true,
        };

        const wrapper = shallow(
            <DotMenu {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
