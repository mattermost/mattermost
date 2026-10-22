// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SaveChangesPanel from './save_changes_panel';

describe('SaveChangesPanel', () => {
    const defaultProps = {
        handleSubmit: jest.fn(),
        handleCancel: jest.fn(),
        handleClose: jest.fn(),
        state: 'saved' as const,
    };

    test('should show default saved message when no customSavedMessage', () => {
        renderWithContext(<SaveChangesPanel {...defaultProps}/>);
        expect(screen.getByText('Settings saved')).toBeInTheDocument();
    });

    test('should show custom saved message when customSavedMessage is provided', () => {
        renderWithContext(
            <SaveChangesPanel
                {...defaultProps}
                customSavedMessage='Policy saved'
            />,
        );
        expect(screen.getByText('Policy saved')).toBeInTheDocument();
        expect(screen.queryByText('Settings saved')).not.toBeInTheDocument();
    });

    test('should show unsaved changes message in editing state', () => {
        renderWithContext(
            <SaveChangesPanel
                {...defaultProps}
                state='editing'
            />,
        );
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });

    test('should show custom error message when provided', () => {
        renderWithContext(
            <SaveChangesPanel
                {...defaultProps}
                state='error'
                customErrorMessage='Failed to save policy'
            />,
        );
        expect(screen.getByText('Failed to save policy')).toBeInTheDocument();
    });
});
