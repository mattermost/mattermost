// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import FilePreviewModalInfo from './file_preview_modal_info';

describe('components/FilePreviewModalInfo', () => {
    const mockedUser = TestHelper.getUserMock();
    const mockedChannel = TestHelper.getChannelMock();

    const baseProps = {
        post: TestHelper.getPostMock({channel_id: 'channel_id'}),
        showFileName: false,
        filename: 'Testing',
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                profiles: {user_id: mockedUser},
            },
            channels: {
                channels: {channel_id: mockedChannel},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <FilePreviewModalInfo {...baseProps}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot where post is missing and avoid crash', () => {
        const props = {...baseProps, post: undefined};
        const {container} = renderWithContext(
            <FilePreviewModalInfo {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });
});
