// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import StatusChip from './status_chip';

describe('StatusChip', () => {
    it('renders the enabled state', () => {
        renderWithContext(
            <StatusChip
                enabled={true}
                testId='admin.session_attributes.status:x'
            />,
        );

        const chip = screen.getByTestId('admin.session_attributes.status:x--text');
        expect(chip).toHaveTextContent('Enabled');
        expect(chip).toHaveAttribute('data-enabled', 'true');
        expect(chip.querySelector('svg')).toBeInTheDocument();
    });

    it('renders the disabled state', () => {
        renderWithContext(
            <StatusChip
                enabled={false}
                testId='admin.session_attributes.status:x'
            />,
        );

        const chip = screen.getByTestId('admin.session_attributes.status:x--text');
        expect(chip).toHaveTextContent('Disabled');
        expect(chip).toHaveAttribute('data-enabled', 'false');
        expect(chip.querySelector('svg')).toBeInTheDocument();
    });
});
