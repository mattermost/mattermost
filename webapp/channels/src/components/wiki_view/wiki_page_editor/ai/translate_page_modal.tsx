// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';

import GlobeIcon from '@mattermost/compass-icons/components/globe';
import {GenericModal} from '@mattermost/components';

import {COMMON_LANGUAGES} from './language_picker';
import type {Language} from './language_picker';

import './translate_page_modal.scss';

export interface TranslatePageModalProps {
    show: boolean;
    pageTitle: string;
    onClose: () => void;
    onTranslate: (language: Language) => Promise<void>;
    isTranslating?: boolean;
}

const TranslatePageModal = ({
    show,
    pageTitle,
    onClose,
    onTranslate,
    isTranslating = false,
}: TranslatePageModalProps) => {
    const {formatMessage} = useIntl();
    const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLanguageSelect = useCallback((lang: Language) => {
        setSelectedLanguage(lang);
        setError(null);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!selectedLanguage) {
            setError(formatMessage({
                id: 'translate_page_modal.error.no_language',
                defaultMessage: 'Please select a target language',
            }));
            return;
        }

        try {
            await onTranslate(selectedLanguage);
            onClose();
        } catch (err) {
            setError(formatMessage({
                id: 'translate_page_modal.error.translation_failed',
                defaultMessage: 'Translation failed. Please try again.',
            }));
        }
    }, [selectedLanguage, onTranslate, onClose, formatMessage]);

    const handleClose = useCallback(() => {
        setSelectedLanguage(null);
        setError(null);
        onClose();
    }, [onClose]);

    return (
        <GenericModal
            id='translate-page-modal'
            className='translate-page-modal'
            modalHeaderText={formatMessage({
                id: 'translate_page_modal.title',
                defaultMessage: 'Translate Page',
            })}
            confirmButtonText={formatMessage({
                id: 'translate_page_modal.confirm',
                defaultMessage: 'Translate',
            })}
            cancelButtonText={formatMessage({
                id: 'translate_page_modal.cancel',
                defaultMessage: 'Cancel',
            })}
            isConfirmDisabled={!selectedLanguage || isTranslating}
            handleConfirm={handleConfirm}
            handleCancel={handleClose}
            onExited={handleClose}
            compassDesign={true}
            show={show}
        >
            <div className='translate-page-modal-content'>
                <div className='translate-page-modal-description'>
                    <FormattedMessage
                        id='translate_page_modal.description'
                        defaultMessage='Create a translated copy of "{pageTitle}" as a new page.'
                        values={{pageTitle}}
                    />
                </div>

                {error && (
                    <div className='translate-page-modal-error'>
                        {error}
                    </div>
                )}

                <div className='translate-page-modal-language-section'>
                    <span className='translate-page-modal-label'>
                        <FormattedMessage
                            id='translate_page_modal.language_label'
                            defaultMessage='Select target language'
                        />
                    </span>

                    <div className='translate-page-modal-language-grid'>
                        {COMMON_LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                type='button'
                                className={`translate-page-modal-language-option ${selectedLanguage?.code === lang.code ? 'selected' : ''}`}
                                onClick={() => handleLanguageSelect(lang)}
                                disabled={isTranslating}
                                data-testid={`translate-modal-${lang.code}`}
                            >
                                <GlobeIcon size={16}/>
                                <span className='translate-page-modal-language-name'>{lang.name}</span>
                                <span className='translate-page-modal-language-native'>{lang.nativeName}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {isTranslating && (
                    <div className='translate-page-modal-processing'>
                        <FormattedMessage
                            id='translate_page_modal.processing'
                            defaultMessage='Translating page content...'
                        />
                    </div>
                )}
            </div>
        </GenericModal>
    );
};

export default TranslatePageModal;
