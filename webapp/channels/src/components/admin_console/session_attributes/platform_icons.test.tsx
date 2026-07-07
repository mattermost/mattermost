// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PlatformIcons from './platform_icons';

describe('PlatformIcons', () => {
    it('always renders the three platforms in fixed order', () => {
        renderWithContext(<PlatformIcons platforms={[]}/>);

        const slots = screen.getByTestId('session-attribute-platforms').querySelectorAll('[data-platform]');
        expect(Array.from(slots).map((slot) => slot.getAttribute('data-platform'))).toEqual(['desktop', 'mobile', 'browser']);
    });

    it('marks present platforms active and absent platforms inactive', () => {
        renderWithContext(<PlatformIcons platforms={['desktop', 'browser']}/>);

        const row = screen.getByTestId('session-attribute-platforms');
        expect(row.querySelector('[data-platform="desktop"]')).toHaveAttribute('data-active', 'true');
        expect(row.querySelector('[data-platform="browser"]')).toHaveAttribute('data-active', 'true');
        expect(row.querySelector('[data-platform="mobile"]')).toHaveAttribute('data-active', 'false');
    });

    it('marks all platforms inactive when none are present', () => {
        renderWithContext(<PlatformIcons platforms={[]}/>);

        const slots = screen.getByTestId('session-attribute-platforms').querySelectorAll('[data-active]');
        expect(Array.from(slots).every((slot) => slot.getAttribute('data-active') === 'false')).toBe(true);
    });

    it('conveys active/inactive state in each icon accessible name', () => {
        renderWithContext(<PlatformIcons platforms={['desktop']}/>);

        expect(screen.getByLabelText('Desktop (active)')).toBeInTheDocument();
        expect(screen.getByLabelText('Mobile (inactive)')).toBeInTheDocument();
        expect(screen.getByLabelText('Browser (inactive)')).toBeInTheDocument();
    });
});
