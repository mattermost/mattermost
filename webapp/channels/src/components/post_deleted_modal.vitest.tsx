// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PostDeletedModal from 'components/post_deleted_modal';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

describe('components/ChannelInfoModal', () => {
    const baseProps = {
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithIntl(
            <PostDeletedModal {...baseProps}/>,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });
});
