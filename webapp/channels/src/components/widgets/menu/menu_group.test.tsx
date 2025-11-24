// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import MenuGroup from './menu_group';

describe('components/MenuGroup', () => {
    test('should render children with default separator', () => {
        render(<MenuGroup>{'text'}</MenuGroup>);

        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();
        expect(screen.getByText('text')).toBeInTheDocument();
    });

    test('should render children with custom divider', () => {
        render(<MenuGroup divider={<div>{'Custom Divider'}</div>}>{'text'}</MenuGroup>);

        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
        expect(screen.getByText('Custom Divider')).toBeInTheDocument();
        expect(screen.getByText('text')).toBeInTheDocument();
    });

    test('should handle divider click without errors', async () => {
        render(<MenuGroup>{'text'}</MenuGroup>);

        const separator = screen.getByRole('separator');

        // Clicking the separator should not cause any errors
        await userEvent.click(separator);

        // Separator should still be in the document
        expect(separator).toBeInTheDocument();
        expect(screen.getByText('text')).toBeInTheDocument();
    });
});
