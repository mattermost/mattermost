// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PaginationButtons from './pagination_buttons';

describe('components/common/PaginationButtons', () => {
    test('renders both buttons with default labels and fires handlers', async () => {
        const onPrevious = jest.fn();
        const onNext = jest.fn();

        renderWithContext(
            <PaginationButtons
                onPrevious={onPrevious}
                onNext={onNext}
            />,
        );

        const previous = screen.getByRole('button', {name: 'Go to previous page'});
        const next = screen.getByRole('button', {name: 'Go to next page'});

        await userEvent.click(previous);
        await userEvent.click(next);

        expect(onPrevious).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    test('omits a button when its handler is undefined', () => {
        renderWithContext(
            <PaginationButtons
                onNext={jest.fn()}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Go to previous page'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Go to next page'})).toBeInTheDocument();
    });

    test('disables buttons when requested or loading', () => {
        renderWithContext(
            <PaginationButtons
                onPrevious={jest.fn()}
                onNext={jest.fn()}
                disablePrevious={true}
                isLoading={true}
            />,
        );

        expect(screen.getByRole('button', {name: 'Go to previous page'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Go to next page'})).toBeDisabled();
    });

    test('uses custom labels and optional class names', () => {
        const {container} = renderWithContext(
            <PaginationButtons
                onPrevious={jest.fn()}
                onNext={jest.fn()}
                previousLabel='Previous'
                nextLabel='Next'
                className='paginationButtons'
                previousButtonClassName='ml-2 prev'
                nextButtonClassName='next'
                nextButtonTestId='page-link-next'
            />,
        );

        expect(container.querySelector('.paginationButtons')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Previous'})).toHaveClass('ml-2', 'prev');
        expect(screen.getByRole('button', {name: 'Next'})).toHaveClass('next');
        expect(screen.getByTestId('page-link-next')).toBeInTheDocument();
    });
});
