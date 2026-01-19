// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl} from 'tests/react_testing_utils';

import PostDeletedModal from './post_deleted_modal';

describe('components/PostDeletedModal', () => {
    const baseProps = {
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithIntl(
            <PostDeletedModal {...baseProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });
});
