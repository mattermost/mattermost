import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EnableSectionContent from './enable_section';

describe('EnableSectionContent', () => {
    const filterToggle = true;
    const setFilterToggle = jest.fn();

    beforeEach(() => {
        setFilterToggle.mockClear();
    });

    test('renders the component', () => {
        render(
            <EnableSectionContent
                filterToggle={filterToggle}
                setFilterToggle={setFilterToggle}
            />,
        );

        expect(screen.getByText('Enable IP Filtering')).toBeInTheDocument();
        expect(screen.getByText('Enable IP Filtering to limit access to your workspace by IP addresses.')).toBeInTheDocument();
        expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
        expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
    });

    test('clicking the toggle calls setFilterToggle', () => {
        render(
            <EnableSectionContent
                filterToggle={filterToggle}
                setFilterToggle={setFilterToggle}
            />,
        );

        fireEvent.click(screen.getByTestId('filterToggle-button'));

        expect(setFilterToggle).toHaveBeenCalledTimes(1);
        expect(setFilterToggle).toHaveBeenCalledWith(false);
    });

    test('renders the component, with toggle not pressed if filterToggle is false', () => {
        render(
            <EnableSectionContent
                filterToggle={false}
                setFilterToggle={setFilterToggle}
            />,
        );

        expect(screen.getByText('Enable IP Filtering')).toBeInTheDocument();
        expect(screen.getByText('Enable IP Filtering to limit access to your workspace by IP addresses.')).toBeInTheDocument();
        expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
        expect(screen.getByRole('button', { pressed: false })).toBeInTheDocument();
    });
});

