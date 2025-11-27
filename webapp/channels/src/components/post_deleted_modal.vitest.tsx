// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import PostDeletedModal from 'components/post_deleted_modal';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

describe('components/PostDeletedModal', () => {
    const baseProps = {
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(
            <PostDeletedModal {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
