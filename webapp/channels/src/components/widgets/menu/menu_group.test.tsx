// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import MenuGroup from './menu_group';

describe('components/MenuItem', () => {
    test('should render with default divider separator', () => {
        const {container} = render(<MenuGroup>{'text'}</MenuGroup>);

        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass('MenuGroup', 'menu-divider');

        expect(container).toHaveTextContent('text');
    });

    test('should render with custom divider content', () => {
        const {container} = render(<MenuGroup divider='--'>{'text'}</MenuGroup>);

        // Custom divider is rendered as plain text, not a separator role
        expect(container).toHaveTextContent('--');
        expect(container).toHaveTextContent('text');

        // Should not have the default separator
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
});
