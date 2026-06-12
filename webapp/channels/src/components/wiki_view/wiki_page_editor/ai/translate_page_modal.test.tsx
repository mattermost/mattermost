// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import {COMMON_LANGUAGES} from './language_picker';
import TranslatePageModal from './translate_page_modal';

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

describe('components/wiki_view/wiki_page_editor/ai/TranslatePageModal', () => {
    const defaultProps = {
        show: true,
        pageTitle: 'Test Page',
        onClose: jest.fn(),
        onTranslate: jest.fn().mockResolvedValue(undefined),
        isTranslating: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render the modal when show is true', () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        expect(screen.getByText('Translate Page')).toBeInTheDocument();
        expect(screen.getByText(/Create a translated copy of "Test Page" as a new page./)).toBeInTheDocument();
    });

    it('should not render the modal when show is false', () => {
        renderWithIntl(
            <TranslatePageModal
                {...defaultProps}
                show={false}
            />,
        );

        expect(screen.queryByText('Translate Page')).not.toBeInTheDocument();
    });

    it('should render all common languages', () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        COMMON_LANGUAGES.forEach((lang) => {
            expect(screen.getByTestId(`translate-modal-${lang.code}`)).toBeInTheDocument();
        });
    });

    it('should highlight selected language', () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        const spanishButton = screen.getByTestId('translate-modal-es');
        fireEvent.click(spanishButton);

        expect(spanishButton).toHaveClass('selected');
    });

    it('should call onTranslate with selected language', async () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        const spanishButton = screen.getByTestId('translate-modal-es');
        fireEvent.click(spanishButton);

        const confirmButton = screen.getByText('Translate');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(defaultProps.onTranslate).toHaveBeenCalledWith(
                expect.objectContaining({code: 'es', name: 'Spanish'}),
            );
        });
    });

    it('should call onClose after successful translation', async () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        const spanishButton = screen.getByTestId('translate-modal-es');
        fireEvent.click(spanishButton);

        const confirmButton = screen.getByText('Translate');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    it('should show error when translation fails', async () => {
        const onTranslate = jest.fn().mockRejectedValue(new Error('Translation failed'));
        renderWithIntl(
            <TranslatePageModal
                {...defaultProps}
                onTranslate={onTranslate}
            />,
        );

        const spanishButton = screen.getByTestId('translate-modal-es');
        fireEvent.click(spanishButton);

        const confirmButton = screen.getByText('Translate');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText('Translation failed. Please try again.')).toBeInTheDocument();
        });
    });

    it('should disable language buttons while translating', () => {
        renderWithIntl(
            <TranslatePageModal
                {...defaultProps}
                isTranslating={true}
            />,
        );

        COMMON_LANGUAGES.forEach((lang) => {
            expect(screen.getByTestId(`translate-modal-${lang.code}`)).toBeDisabled();
        });
    });

    it('should show processing message while translating', () => {
        renderWithIntl(
            <TranslatePageModal
                {...defaultProps}
                isTranslating={true}
            />,
        );

        expect(screen.getByText('Translating page content...')).toBeInTheDocument();
    });

    it('should disable confirm button while translating', () => {
        renderWithIntl(
            <TranslatePageModal
                {...defaultProps}
                isTranslating={true}
            />,
        );

        const confirmButton = screen.getByText('Translate');
        expect(confirmButton).toBeDisabled();
    });

    it('should disable confirm button when no language is selected', () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        const confirmButton = screen.getByText('Translate');
        expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when language is selected', () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        const spanishButton = screen.getByTestId('translate-modal-es');
        fireEvent.click(spanishButton);

        const confirmButton = screen.getByText('Translate');
        expect(confirmButton).not.toBeDisabled();
    });

    it('should call onClose when cancel button is clicked', () => {
        renderWithIntl(<TranslatePageModal {...defaultProps}/>);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(defaultProps.onClose).toHaveBeenCalled();
    });
});
