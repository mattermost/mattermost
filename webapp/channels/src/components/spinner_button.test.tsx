// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SpinnerButton from 'components/spinner_button';

describe('components/SpinnerButton', () => {
    test('should render with required props', () => {
        render(
            <SpinnerButton
                spinning={false}
                spinningText='Test'
            />,
        );

        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeEnabled();
    });

    test('should render with spinning state', () => {
        render(
            <SpinnerButton
                spinning={true}
                spinningText='Test'
            />,
        );

        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should render with children', () => {
        render(
            <SpinnerButton
                spinning={false}
                spinningText='Test'
            >
                <span id='child1' data-testid='child1'/>
                <span id='child2' data-testid='child2'/>
            </SpinnerButton>,
        );

        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByRole('button')).toContainElement(screen.getByTestId('child1'));
        expect(screen.getByRole('button')).toContainElement(screen.getByTestId('child2'));
    });

    test('should handle onClick', async () => {
        const onClick = jest.fn();

        render(
            <SpinnerButton
                spinning={false}
                onClick={onClick}
                spinningText='Test'
            />,
        );

        await userEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should have correct button properties', () => {
        render(
            <SpinnerButton
                id='my-button-id'
                className='btn btn-success'
                spinningText='Test'
                spinning={false}
            />,
        );

        const button = screen.getByRole('button');

        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('id', 'my-button-id');
        expect(button).toHaveClass('btn', 'btn-success');
    });
});
