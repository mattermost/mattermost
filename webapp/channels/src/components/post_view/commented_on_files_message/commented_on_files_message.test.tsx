// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import CommentedOnFilesMessage from './commented_on_files_message';

describe('components/CommentedOnFilesMessage', () => {
    test('component state when no files', () => {
        render(
            <CommentedOnFilesMessage testId='rhs.thread.post.commented_on.files'/>,
        );

        //no file is given in props
        expect(screen.queryByTestId('rhs.thread.post.commented_on.files--text')).not.toBeInTheDocument();
    });

    test('should match component state for single file', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1}),
        ];

        render(
            <CommentedOnFilesMessage
                fileInfos={fileInfos}
                testId='rhs.thread.post.commented_on.files'
            />,
        );
        expect(screen.getByTestId('rhs.thread.post.commented_on.files--text')).toHaveTextContent('image_1.png');
    });

    test('should match component state for multiple files', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3}),
            TestHelper.getFileInfoMock({id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2}),
            TestHelper.getFileInfoMock({id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1}),
        ];

        renderWithContext(
            <CommentedOnFilesMessage
                fileInfos={fileInfos}
                testId='rhs.thread.post.commented_on.files'
            />,
        );

        // total files = 3
        expect(screen.getByTestId('rhs.thread.post.commented_on.files--text')).toHaveTextContent('image_3.png plus 2 other files');
    });
});
