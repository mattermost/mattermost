// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import ImageExtractionCompleteDialog from './image_extraction_complete_dialog';

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

describe('components/wiki_view/wiki_page_editor/ai/ImageExtractionCompleteDialog', () => {
    const defaultProps = {
        show: true,
        actionType: 'extract_handwriting' as const,
        pageTitle: 'Test Extraction Page',
        onGoToDraft: jest.fn(),
        onStayHere: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when show is false', () => {
        renderWithIntl(
            <ImageExtractionCompleteDialog
                {...defaultProps}
                show={false}
            />,
        );
        expect(screen.queryByText('Text Extracted')).not.toBeInTheDocument();
    });

    it('should render for handwriting extraction with insert option', () => {
        const onInsertContent = jest.fn();
        renderWithIntl(
            <ImageExtractionCompleteDialog
                {...defaultProps}
                onInsertContent={onInsertContent}
            />,
        );

        expect(screen.getByText('Text Extracted')).toBeInTheDocument();
        expect(screen.getByText(/The text has been extracted/)).toBeInTheDocument();
        expect(screen.getByText('Insert into page')).toBeInTheDocument();
    });

    it('should render for image description', () => {
        renderWithIntl(
            <ImageExtractionCompleteDialog
                {...defaultProps}
                actionType='describe_image'
            />,
        );

        expect(screen.getByText('Image Described')).toBeInTheDocument();
        expect(screen.getByText(/The image description has been saved/)).toBeInTheDocument();
    });

    it('should call onInsertContent when Insert into page button is clicked for handwriting', () => {
        const onInsertContent = jest.fn();
        renderWithIntl(
            <ImageExtractionCompleteDialog
                {...defaultProps}
                onInsertContent={onInsertContent}
            />,
        );

        const insertButton = screen.getByText('Insert into page');
        fireEvent.click(insertButton);

        expect(onInsertContent).toHaveBeenCalled();
        expect(defaultProps.onGoToDraft).not.toHaveBeenCalled();
    });

    it('should call onGoToDraft when Go to draft button is clicked for describe_image', () => {
        renderWithIntl(
            <ImageExtractionCompleteDialog
                {...defaultProps}
                actionType='describe_image'
            />,
        );

        const goToDraftButton = screen.getByText('Go to draft');
        fireEvent.click(goToDraftButton);

        expect(defaultProps.onGoToDraft).toHaveBeenCalled();
    });

    it('should call onStayHere when Stay here button is clicked', () => {
        renderWithIntl(<ImageExtractionCompleteDialog {...defaultProps}/>);

        const stayHereButton = screen.getByText('Stay here');
        fireEvent.click(stayHereButton);

        expect(defaultProps.onStayHere).toHaveBeenCalled();
    });

    it('should show check icon', () => {
        renderWithIntl(<ImageExtractionCompleteDialog {...defaultProps}/>);

        // The dialog should contain a success icon
        const iconContainer = document.querySelector('.image-extraction-complete-dialog-icon');
        expect(iconContainer).toBeInTheDocument();
    });
});
