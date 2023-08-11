// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {shallow} from 'enzyme';

import type {GlobalState} from 'types/store';
import {TestHelper} from 'utils/test_helper';

import FilePreviewModalInfo from './file_preview_modal_info';

const mockDispatch = jest.fn();
let mockState: GlobalState;
const mockedUser = TestHelper.getUserMock();
const mockedChannel = TestHelper.getChannelMock();
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));
describe('components/FilePreviewModalInfo', () => {
    let baseProps: ComponentProps<typeof FilePreviewModalInfo>;
    beforeEach(() => {
        baseProps = {
            post: TestHelper.getPostMock({channel_id: 'channel_id'}),
            showFileName: false,
            filename: 'Testing',
        };

        mockState = {
            entities: {
                general: {config: {}},
                users: {profiles: {}},
                channels: {channels: {}},
                preferences: {
                    myPreferences: {

                    },
                },
            },
        } as GlobalState;
    });
    test('should match snapshot', () => {
        mockState.entities.users.profiles = {user_id: mockedUser};
        mockState.entities.channels.channels = {channel_id: mockedChannel};
        const wrapper = shallow<typeof FilePreviewModalInfo>(
            <FilePreviewModalInfo
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot where post is missing and avoid crash', () => {
        mockState.entities.users.profiles = {user_id: mockedUser};
        mockState.entities.channels.channels = {channel_id: mockedChannel};
        baseProps.post = undefined;
        const wrapper = shallow<typeof FilePreviewModalInfo>(
            <FilePreviewModalInfo
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
