// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderWithFullContext} from "tests/react_testing_utils";
import React from "react";
import ConvertGmToChannelModal from "components/convert_gm_to_channel_modal/convert_gm_to_channel_modal";
import {Props} from "components/convert_gm_to_channel_modal/convert_gm_to_channel_modal";
import {Channel} from "@mattermost/types/channels";
import {UserProfile} from "@mattermost/types/users";

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {Preferences} from "mattermost-redux/constants";


describe('component/ConvertGmToChannelModal', () => {

    const user1 = TestHelper.fakeUserWithId();
    const user2 = TestHelper.fakeUserWithId();
    const user3 = TestHelper.fakeUserWithId();

    const baseProps: Props = {
        onExited: jest.fn(),
        channel: {id: 'asdasd', type: 'G'} as Channel,
        actions: {
            closeModal: jest.fn(),
            convertGroupMessageToPrivateChannel: jest.fn(),
            moveChannelsInSidebar: jest.fn(),
        },
        profilesInChannel: [user1, user2, user3] as UserProfile[],
        teammateNameDisplaySetting: Preferences.DISPLAY_PREFER_FULL_NAME,
        channelsCategoryId: 'sidebar_category_1',
        currentUserId: user1.id,
    }


    test('base case', () => {
        renderWithFullContext(
            <ConvertGmToChannelModal {...baseProps}/>
        );
    });
});