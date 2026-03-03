// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import ImageExtractionDialog from './image_extraction_dialog';

const renderWithIntl = (component: React.ReactElement) => {
    return render(
        <IntlProvider
            locale='en'
            messages={{}}
        >
            {component}
        </IntlProvider>,
    );
};

describe('components/wiki_view/wiki_page_editor/ai/ImageExtractionDialog', () => {
    const defaultProps = {
        show: true,
        actionType: 'extract_handwriting' as const,
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when show is false', () => {
        renderWithIntl(
            <ImageExtractionDialog
                {...defaultProps}
                show={false}
            />,
        );
        expect(screen.queryByText('Extracting Handwriting')).not.toBeInTheDocument();
    });

    it('should render for handwriting extraction', () => {
        renderWithIntl(<ImageExtractionDialog {...defaultProps}/>);

        expect(screen.getByText('Extracting Handwriting')).toBeInTheDocument();
        expect(screen.getByText(/AI is analyzing the image and extracting handwritten text/)).toBeInTheDocument();
    });

    it('should render for image description', () => {
        renderWithIntl(
            <ImageExtractionDialog
                {...defaultProps}
                actionType='describe_image'
            />,
        );

        expect(screen.getByText('Analyzing Image')).toBeInTheDocument();
        expect(screen.getByText(/AI is analyzing the image and generating a description/)).toBeInTheDocument();
    });

    it('should show progress text when provided', () => {
        renderWithIntl(
            <ImageExtractionDialog
                {...defaultProps}
                progress='Extracting text...'
            />,
        );

        expect(screen.getByText('Extracting text...')).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
        renderWithIntl(<ImageExtractionDialog {...defaultProps}/>);

        // The GenericModal has both a cancel and confirm button, both say "Cancel" in this case
        // Use getAllByText and get the first one (the cancel button)
        const cancelButtons = screen.getAllByText('Cancel');
        fireEvent.click(cancelButtons[0]);

        expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should show loading spinner', () => {
        renderWithIntl(<ImageExtractionDialog {...defaultProps}/>);

        expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
    });
});
