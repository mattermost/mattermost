// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import EnableSectionContent from './enable_section';
jest.mock('components/external_link', () => {
    return jest.fn().mockImplementation(({children, ...props}) => {
        return <a {...props}>{children}</a>;
    });
});

describe('EnableSectionContent', () => {
    const filterToggle = true;
    const setFilterToggle = jest.fn();

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
        renderWithContext(
            <EnableSectionContent
                {...baseProps}
            />,
        );

        fireEvent.click(screen.getByTestId('filterToggle-button'));

        expect(setFilterToggle).toHaveBeenCalledTimes(1);
        expect(setFilterToggle).toHaveBeenCalledWith(false);
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

