// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderWithFullContext} from "tests/react_testing_utils";
import React from "react";
import ConvertGmToChannelModal, {Actions} from "components/convert_gm_to_channel_modal/index";
import {Props} from "components/convert_gm_to_channel_modal/convert_gm_to_channel_modal";
import {Channel} from "@mattermost/types/lib/channels";
import {UserProfile} from "@mattermost/types/lib/users";
import {TestHelper} from "utils/test_helper";

// describe('component/ConvertGmToChannelModal', () => {
//
//     const baseProps: Props = {
//         onExited: jest.fn(),
//         channel: {},
//         actions: {},
//         profilesInChannel: [
//             TestHelper.fakeUser(),
//         ] as UserProfile[],
//         // teammateNameDisplaySetting: string;
//         // channelsCategoryId: string | undefined;
//         // currentUserId: string;
//     }
//
//
//     test('base case', () => {
//         renderWithFullContext(
//             <ConvertGmToChannelModal/>
//         )
//     });
// });