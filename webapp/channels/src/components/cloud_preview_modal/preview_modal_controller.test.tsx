// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {PreviewModalContentData} from './preview_modal_content_data';
import PreviewModalController from './preview_modal_controller';

// Mock the GenericModal component
jest.mock('@mattermost/components', () => ({
    GenericModal: ({children, show, footerContent}: {children: React.ReactNode; show: boolean; footerContent?: React.ReactNode}) => (
        show ? (
            <div data-testid='modal'>
                <div>{children}</div>
                {footerContent && <div data-testid='modal-footer'>{footerContent}</div>}
            </div>
        ) : null
    ),
}));

// Mock the icons
jest.mock('@mattermost/compass-icons/components', () => ({
    ChevronLeftIcon: ({size}: {size: number}) => <span data-testid='chevron-left-icon'>{size}</span>,
    ChevronRightIcon: ({size}: {size: number}) => <span data-testid='chevron-right-icon'>{size}</span>,
    CloseIcon: ({size}: {size: number}) => <span data-testid='close-icon'>{size}</span>,
}));

describe('PreviewModalController', () => {
    const mockOnClose = jest.fn();

    const contentData: PreviewModalContentData[] = [
        {
            title: 'First Slide',
            subtitle: 'First subtitle',
            skuLabel: 'First sku label',
            videoUrl: 'https://www.youtube.com/watch?v=E3EGLxgNxNA',
            useCase: 'missionops',
        },
        {
            title: 'Second Slide',
            subtitle: 'Second subtitle',
            skuLabel: 'Second sku label',
            videoUrl: 'https://www.youtube.com/watch?v=E3EGLxgNxNA',
            useCase: 'missionops',
        },
        {
            title: 'Third Slide',
            subtitle: 'Third subtitle',
            skuLabel: 'Third sku label',
            videoUrl: 'https://www.youtube.com/watch?v=E3EGLxgNxNA',
            useCase: 'missionops',
        },
    ];

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    const renderComponent = (props = {}) => {
        return render(
            <IntlProvider locale='en'>
                <PreviewModalController
                    show={true}
                    onClose={mockOnClose}
                    contentData={contentData}
                    {...props}
                />
            </IntlProvider>,
        );
    };

    it('should render when show is true', () => {
        renderComponent();
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should not render when show is false', () => {
        renderComponent({show: false});
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render first slide initially', () => {
        renderComponent();
        expect(screen.getByText('First Slide')).toBeInTheDocument();
        expect(screen.queryByText('Second Slide')).not.toBeInTheDocument();
    });

    it('should render pagination dots', () => {
        renderComponent();

        // Find dots by their container and check children
        const dotsContainer = screen.getByTestId('pagination-dots');
        expect(dotsContainer.children).toHaveLength(3);
    });

    it('should render page counter', () => {
        renderComponent();
        expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('should update page counter when navigating', () => {
        renderComponent();

        expect(screen.getByText('1/3')).toBeInTheDocument();

        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);

        expect(screen.getByText('2/3')).toBeInTheDocument();
    });

    it('should navigate to next slide when Next is clicked', () => {
        renderComponent();

        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);

        expect(screen.getByText('Second Slide')).toBeInTheDocument();
        expect(screen.queryByText('First Slide')).not.toBeInTheDocument();
    });

    it('should navigate to previous slide when Previous is clicked', () => {
        renderComponent();

        // Go to second slide first
        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);

        // Now go back
        const previousButton = screen.getByText('Previous');
        fireEvent.click(previousButton);

        expect(screen.getByText('First Slide')).toBeInTheDocument();
        expect(screen.queryByText('Second Slide')).not.toBeInTheDocument();
    });

    it('should show Skip for now button only on first slide', () => {
        renderComponent();

        // First slide should have Skip button
        expect(screen.getByText('Skip for now')).toBeInTheDocument();

        // Go to second slide
        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);

        // Second slide should not have Skip button
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument();
    });

    it('should not show Previous button on first slide', () => {
        renderComponent();
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });

    it('should show Done button on last slide', () => {
        renderComponent();

        // Navigate to last slide
        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);
        fireEvent.click(nextButton);

        expect(screen.getByText('Finish')).toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('should call onClose when Skip is clicked', () => {
        renderComponent();

        const skipButton = screen.getByText('Skip for now');
        fireEvent.click(skipButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Finish is clicked on last slide', () => {
        renderComponent();

        // Navigate to last slide
        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);
        fireEvent.click(nextButton);

        const finishButton = screen.getByText('Finish');
        fireEvent.click(finishButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
        renderComponent();

        const closeButton = screen.getByLabelText('Close modal');
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not render if contentData is empty', () => {
        renderComponent({contentData: []});
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
});
