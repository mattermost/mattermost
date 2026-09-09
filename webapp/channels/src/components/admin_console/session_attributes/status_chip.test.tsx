// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import StatusChip from './status_chip';

describe('StatusChip', () => {
    it('renders the enabled state', () => {
        renderWithContext(<StatusChip enabled={true}/>);

        const chip = screen.getByTestId('session-attribute-status');
        expect(chip).toHaveTextContent('Enabled');
        expect(chip).toHaveAttribute('data-enabled', 'true');
        expect(chip.querySelector('svg')).toBeInTheDocument();
    });

    it('renders the disabled state', () => {
        renderWithContext(<StatusChip enabled={false}/>);

        const chip = screen.getByTestId('session-attribute-status');
        expect(chip).toHaveTextContent('Disabled');
        expect(chip).toHaveAttribute('data-enabled', 'false');
        expect(chip.querySelector('svg')).toBeInTheDocument();
    });
});
