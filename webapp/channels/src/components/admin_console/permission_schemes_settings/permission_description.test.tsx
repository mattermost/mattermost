// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';
import PermissionDescription from './permission_description';

describe('components/admin_console/permission_schemes_settings/permission_description', () => {
    const defaultProps = {
        id: 'defaultID',
        selectRow: jest.fn(),
        description: 'This is the description',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with default props', () => {
        renderWithContext(
            <PermissionDescription
                {...defaultProps}
            />
        );

        expect(screen.getByText('This is the description')).toBeInTheDocument();
    });

    test('should render inherited description', () => {
        renderWithContext(
            <PermissionDescription
                {...defaultProps}
                inherited={{
                    name: 'all_users',
                }}
            />
        );

        // The text will be "Inherited from All Members."
        expect(screen.getByText('Inherited from')).toBeInTheDocument();
        expect(screen.getByText('All Members')).toBeInTheDocument();
        
        // The link should be rendered inside the text
        const link = screen.getByText('All Members');
        expect(link.tagName).toBe('A');
    });

    test('should render with custom JSX description', () => {
        const description = (
            <span data-testid="custom-description">{'This is a clickable description'}</span>
        );
        
        renderWithContext(
            <PermissionDescription
                {...defaultProps}
                description={description}
            />
        );

        expect(screen.getByTestId('custom-description')).toBeInTheDocument();
        expect(screen.getByText('This is a clickable description')).toBeInTheDocument();
    });

    test('should call selectRow when inherited link is clicked', () => {
        const selectRow = jest.fn();

        renderWithContext(
            <PermissionDescription
                {...defaultProps}
                inherited={{
                    name: 'all_users',
                }}
                selectRow={selectRow}
            />
        );

        const link = screen.getByText('All Members');
        fireEvent.click(link);
        
        expect(selectRow).toHaveBeenCalledWith('defaultID');
    });
    
    test('should not call selectRow when clicking outside of link or description', () => {
        const selectRow = jest.fn();
        
        const {container} = renderWithContext(
            <PermissionDescription
                {...defaultProps}
                selectRow={selectRow}
            />
        );
        
        // Click on the wrapper component
        fireEvent.click(container.firstChild as Element);
        
        expect(selectRow).not.toHaveBeenCalled();
    });
});
