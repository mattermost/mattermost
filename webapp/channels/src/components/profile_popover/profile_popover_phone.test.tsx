// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverPhone from './profile_popover_phone';

describe('components/ProfilePopoverPhone', () => {
    test('should not render when phone is undefined', () => {
        renderWithContext(<ProfilePopoverPhone/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should not render when phone is empty', () => {
        renderWithContext(<ProfilePopoverPhone phone=''/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render phone with icon', () => {
        const phone = '+1 (555) 123-4567';
        renderWithContext(<ProfilePopoverPhone phone={phone}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'tel:+1 (555) 123-4567');
        expect(link).toHaveTextContent(phone);
        expect(screen.getByTitle(phone)).toBeInTheDocument();
        expect(screen.getByLabelText('phone icon')).toBeInTheDocument();
    });

    test('should handle international phone numbers', () => {
        const phone = '+44 20 7123 4567';
        renderWithContext(<ProfilePopoverPhone phone={phone}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'tel:+44 20 7123 4567');
        expect(link).toHaveTextContent(phone);
    });
});
