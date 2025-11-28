// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import EnableSectionContent from './enable_section';

vi.mock('components/external_link', () => ({
    default: vi.fn().mockImplementation(({children, ...props}) => {
        return <a {...props}>{children}</a>;
    }),
}));

describe('EnableSectionContent', () => {
    const filterToggle = true;
    const setFilterToggle = vi.fn();

    const baseProps = {
        filterToggle,
        setFilterToggle,
    };

    test('renders the component', () => {
        renderWithContext(
            <EnableSectionContent
                {...baseProps}
            />,
        );

        expect(screen.getByText('Enable IP Filtering')).toBeInTheDocument();
        expect(screen.getByText('Limit access to your workspace by IP address.')).toBeInTheDocument();
        expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
        expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
    });

    test('clicking the toggle calls setFilterToggle', () => {
        const setFilterToggleLocal = vi.fn();
        renderWithContext(
            <EnableSectionContent
                {...baseProps}
                setFilterToggle={setFilterToggleLocal}
            />,
        );

        fireEvent.click(screen.getByTestId('filterToggle-button'));

        expect(setFilterToggleLocal).toHaveBeenCalledTimes(1);
        expect(setFilterToggleLocal).toHaveBeenCalledWith(false);
    });

    test('renders the component, with toggle not pressed if filterToggle is false', () => {
        renderWithContext(
            <EnableSectionContent
                {...baseProps}
                filterToggle={false}
            />,
        );

        expect(screen.getByText('Enable IP Filtering')).toBeInTheDocument();
        expect(screen.getByText('Limit access to your workspace by IP address.')).toBeInTheDocument();
        expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
        expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
    });
});
