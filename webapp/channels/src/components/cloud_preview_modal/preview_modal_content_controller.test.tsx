// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PreviewModalController from './preview_modal_content_controller';
import type {PreviewModalContentData} from './preview_modal_content_data';

describe('PreviewModalController', () => {
    const mockOnClose = jest.fn();

    const contentData: PreviewModalContentData[] = [
        {
            title: {
                id: 'test.slide1.title',
                defaultMessage: 'First Slide',
            },
            subtitle: {
                id: 'test.slide1.subtitle',
                defaultMessage: 'First subtitle',
            },
            skuLabel: {
                id: 'test.slide1.sku_label',
                defaultMessage: 'First sku label',
            },
            videoUrl: 'https://example.com/test-video-1.mp4',
            useCase: 'missionops',
        },
        {
            title: {
                id: 'test.slide2.title',
                defaultMessage: 'Second Slide',
            },
            subtitle: {
                id: 'test.slide2.subtitle',
                defaultMessage: 'Second subtitle',
            },
            skuLabel: {
                id: 'test.slide2.sku_label',
                defaultMessage: 'Second sku label',
            },
            videoUrl: 'https://example.com/test-video-2.mp4',
            useCase: 'missionops',
        },
        {
            title: {
                id: 'test.slide3.title',
                defaultMessage: 'Third Slide',
            },
            subtitle: {
                id: 'test.slide3.subtitle',
                defaultMessage: 'Third subtitle',
            },
            skuLabel: {
                id: 'test.slide3.sku_label',
                defaultMessage: 'Third sku label',
            },
            videoUrl: 'https://example.com/test-video-3.mp4',
            useCase: 'missionops',
        },
    ];

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    const renderComponent = (props = {}) => {
        return renderWithContext(
            <PreviewModalController
                show={true}
                onClose={mockOnClose}
                contentData={contentData}
                {...props}
            />,
        );
    };

    it('should render when show is true', () => {
        renderComponent();

        // Look for the modal content instead of a mocked test id
        expect(screen.getByText('First Slide')).toBeInTheDocument();
    });

    it('should not render when show is false', () => {
        renderComponent({show: false});
        expect(screen.queryByText('First Slide')).not.toBeInTheDocument();
    });

    it('should use default content when contentData is not provided', () => {
        renderWithContext(
            <PreviewModalController
                show={true}
                onClose={mockOnClose}
            />,
        );

        // Should still render the modal with default content (first item from modalContent)
        expect(screen.getByText('Welcome to your Mattermost preview')).toBeInTheDocument();
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

    it('should update page counter when navigating', async () => {
        renderComponent();

        expect(screen.getByText('1/3')).toBeInTheDocument();

        const nextButton = screen.getByText('Next');
        await userEvent.click(nextButton);

        expect(screen.getByText('2/3')).toBeInTheDocument();
    });

    it('should navigate to next slide when Next is clicked', async () => {
        renderComponent();

        const nextButton = screen.getByText('Next');
        await userEvent.click(nextButton);

        expect(screen.getByText('Second Slide')).toBeInTheDocument();
        expect(screen.queryByText('First Slide')).not.toBeInTheDocument();
    });

    it('should navigate to previous slide when Previous is clicked', async () => {
        renderComponent();

        // Go to second slide first
        const nextButton = screen.getByText('Next');
        await userEvent.click(nextButton);

        // Now go back
        const previousButton = screen.getByText('Previous');
        await userEvent.click(previousButton);

        expect(screen.getByText('First Slide')).toBeInTheDocument();
        expect(screen.queryByText('Second Slide')).not.toBeInTheDocument();
    });

    it('should show Skip for now button only on first slide', async () => {
        renderComponent();

        // First slide should have Skip button
        expect(screen.getByText('Skip for now')).toBeInTheDocument();

        // Go to second slide
        const nextButton = screen.getByText('Next');
        await userEvent.click(nextButton);

        // Second slide should not have Skip button
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument();
    });

    it('should not show Previous button on first slide', () => {
        renderComponent();
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });

    it('should show Done button on last slide', async () => {
        renderComponent();

        // Navigate to last slide
        const nextButton = screen.getByText('Next');
        await userEvent.click(nextButton);
        await userEvent.click(nextButton);

        expect(screen.getByText('Finish')).toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('should call onClose when Skip is clicked', async () => {
        renderComponent();

        const skipButton = screen.getByText('Skip for now');
        await userEvent.click(skipButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Finish is clicked on last slide', async () => {
        renderComponent();

        // Navigate to last slide
        const nextButton = screen.getByText('Next');
        await userEvent.click(nextButton);
        await userEvent.click(nextButton);

        const finishButton = screen.getByText('Finish');
        await userEvent.click(finishButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', async () => {
        renderComponent();

        // Look for the actual close button from GenericModal
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not render if contentData is empty', () => {
        renderComponent({contentData: []});
        expect(screen.queryByText('First Slide')).not.toBeInTheDocument();
    });
});
