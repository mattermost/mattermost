// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {userEvent} from '@testing-library/user-event';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PlatformIcons from './platform_icons';

describe('PlatformIcons', () => {
    it('always renders the three platforms in fixed order', () => {
        renderWithContext(
            <PlatformIcons
                platforms={[]}
                testId='admin.session_attributes.platforms:x'
            />,
        );

        const slots = screen.getByTestId('admin.session_attributes.platforms:x').querySelectorAll('[data-platform]');
        expect(Array.from(slots).map((slot) => slot.getAttribute('data-platform'))).toEqual(['desktop', 'mobile', 'browser']);
    });

    it('marks present platforms active and absent platforms inactive', () => {
        renderWithContext(
            <PlatformIcons
                platforms={['desktop', 'browser']}
                testId='admin.session_attributes.platforms:x'
            />,
        );

        const row = screen.getByTestId('admin.session_attributes.platforms:x');
        expect(row.querySelector('[data-platform="desktop"]')).toHaveAttribute('data-active', 'true');
        expect(row.querySelector('[data-platform="browser"]')).toHaveAttribute('data-active', 'true');
        expect(row.querySelector('[data-platform="mobile"]')).toHaveAttribute('data-active', 'false');
    });

    it('marks all platforms inactive when none are present', () => {
        renderWithContext(
            <PlatformIcons
                platforms={[]}
                testId='admin.session_attributes.platforms:x'
            />,
        );

        const slots = screen.getByTestId('admin.session_attributes.platforms:x').querySelectorAll('[data-active]');
        expect(Array.from(slots).every((slot) => slot.getAttribute('data-active') === 'false')).toBe(true);
    });

    it('conveys active/inactive state in each icon accessible name', () => {
        renderWithContext(
            <PlatformIcons
                platforms={['desktop']}
                testId='admin.session_attributes.platforms:x'
            />,
        );

        expect(screen.getByLabelText('Desktop (active)')).toBeInTheDocument();
        expect(screen.getByLabelText('Mobile (inactive)')).toBeInTheDocument();
        expect(screen.getByLabelText('Browser (inactive)')).toBeInTheDocument();
    });

    it.each([
        ['desktop', 'Desktop'],
        ['mobile', 'Mobile'],
        ['browser', 'Browser'],
    ])('reveals the %s platform tooltip on hover', async (_platform, tooltipText) => {
        renderWithContext(
            <PlatformIcons
                platforms={['desktop', 'mobile', 'browser']}
                testId='admin.session_attributes.platforms:x'
            />,
        );

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        const iconReference = screen.getByLabelText(`${tooltipText} (active)`).parentElement as HTMLElement;
        await userEvent.hover(iconReference);

        const tooltip = await screen.findByRole('tooltip', {hidden: true}, {timeout: 2000});
        expect(tooltip).toHaveTextContent(tooltipText);
    });
});
