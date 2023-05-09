// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CommentedOnFilesMessage from './commented_on_files_message';
import {render, screen} from '@testing-library/react';
import {renderWithIntl} from 'tests/react_testing_utils';

describe('components/CommentedOnFilesMessage', () => {
    const baseProps = {
        parentPostId: 'parentPostId',
    };

    test('component state when no files', () => {
        render(
            <CommentedOnFilesMessage {...baseProps}/>,
        );

        //no file is given in props
        expect(screen.queryByTestId('fileInfo')).not.toBeInTheDocument();
    });

    test('should match component state for single file', () => {
        const props = {
            ...baseProps,
            fileInfos: [{id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1}],
        };

        render(
            <CommentedOnFilesMessage {...props}/>,
        );
        expect(screen.getByTestId('fileInfo')).toHaveTextContent('image_1.png');
    });

    test('should match component state for multiple files', () => {
        const fileInfos = [
            {id: 'file_id_3', name: 'image_3.png', extension: 'png', create_at: 3},
            {id: 'file_id_2', name: 'image_2.png', extension: 'png', create_at: 2},
            {id: 'file_id_1', name: 'image_1.png', extension: 'png', create_at: 1},
        ];

        const props = {
            ...baseProps,
            fileInfos,
        };

        renderWithIntl(
            <CommentedOnFilesMessage {...props}/>,
        );

        // total files = 3
        expect(screen.getByTestId('fileInfo')).toHaveTextContent('image_3.png plus 2 other files');
    });
});
