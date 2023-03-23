// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';

import {renderWithIntl} from 'tests/react_testing_utils';

import EditableArea from './editable_area';

describe('channel_info_rhs/components/editable_area', () => {
    test('should be able to see content', async () => {
        renderWithIntl(
            <EditableArea
                content='test content'
                editable={true}
                emptyLabel=''
                onEdit={() => {}}
            />,
        );

        expect(screen.getByText('test content')).toBeInTheDocument();
    });

    test('should be able to edit content', async () => {
        const mockOnEdit = jest.fn();
        renderWithIntl(
            <EditableArea
                content='test content'
                editable={true}
                emptyLabel=''
                onEdit={mockOnEdit}
            />,
        );

        expect(screen.getByLabelText('Edit')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Edit'));
        expect(mockOnEdit).toHaveBeenCalled();
    });

    test('should be able prevent edition', async () => {
        renderWithIntl(
            <EditableArea
                content='test content'
                editable={false}
                emptyLabel=''
                onEdit={() => {}}
            />,
        );

        expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument();
    });

    test('should show the empty label when there\'s no content', async () => {
        const mockOnEdit = jest.fn();
        renderWithIntl(
            <EditableArea
                content=''
                editable={true}
                emptyLabel='No content'
                onEdit={mockOnEdit}
            />,
        );

        expect(screen.getByText('No content')).toBeInTheDocument();

        // We should be able to click on the text...
        fireEvent.click(screen.getByText('No content'));

        // ... or the Edit icon
        fireEvent.click(screen.getByLabelText('Edit'));
        expect(mockOnEdit).toHaveBeenCalledTimes(2);
    });
});
