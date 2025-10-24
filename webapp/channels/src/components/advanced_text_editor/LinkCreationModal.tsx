// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import './link_creation_modal.scss';

// --- Type Definitions ---
type Props = {
    show: boolean;
    onHide: () => void;
    onExited: () => void;
    // Function to call when the user clicks 'Insert', passing the final text and URL
    onInsert: (text: string, url: string) => void;
    // Optional initial text (e.g., text selected by the user in the editor)
    initialText?: string;
}

// --- Component Definition ---

export default function LinkCreationModal({
    show,
    onHide,
    onExited,
    onInsert,
    initialText = '',
}: Props) {
    const {formatMessage} = useIntl();
    const [displayText, setDisplayText] = useState(initialText);
    const [url, setUrl] = useState('');

    const [urlError, setUrlError] = useState('');
    const [textError, setTextError] = useState('');

    // Update internal state when the modal is shown with initial text
    useEffect(() => {
        if (show) {
            setDisplayText(initialText);
            setUrl('');
            setUrlError('');
            setTextError('');
        }
    }, [show, initialText]);

    const handleHide = useCallback(() => {
        setDisplayText('');
        setUrl('');
        setUrlError('');
        setTextError('');
        onHide();
    }, [onHide]);

    const handleSubmit = useCallback(() => {
        let valid = true;
        let newUrlError = '';
        let newTextError = '';

        if (!url.trim()) {
            newUrlError = formatMessage({
                id: 'link_modal.error.url_missing',
                defaultMessage: 'URL is required.',
            });
            valid = false;
        }

        if (!displayText.trim()) {
            newTextError = formatMessage({
                id: 'link_modal.error.text_missing',
                defaultMessage: 'Display text is required.',
            });
            valid = false;
        }

        setUrlError(newUrlError);
        setTextError(newTextError);

        if (valid) {
            onInsert(displayText.trim(), url.trim());
            handleHide();
        }
    }, [url, displayText, onInsert, handleHide, formatMessage]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    const modalTitle = formatMessage({
        id: 'link_modal.title',
        defaultMessage: 'Insert Link',
    });

    return (
        <Modal
            dialogClassName='a11y__modal link-creation-modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            role='dialog'
            aria-labelledby='linkCreationModalLabel'
        >
            <Modal.Header
                id='linkCreationModalLabel'
                closeButton={true}
            >
                <h5 className='modal-title'>{modalTitle}</h5>
            </Modal.Header>
            <Modal.Body>
                <div className='form-group'>
                    <label htmlFor='linkModalText'>
                        <FormattedMessage
                            id='link_modal.text_label'
                            defaultMessage='Text to display'
                        />
                    </label>
                    <input
                        id='linkModalText'
                        className={classNames('form-control', {'has-error': textError})}
                        type='text'
                        value={displayText}
                        onChange={(e) => setDisplayText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus={!initialText} // Focus text field if empty
                        maxLength={100} // Arbitrary limit, adjust as needed
                        placeholder={formatMessage({id: 'link_modal.text_placeholder', defaultMessage: 'Display Text'})}
                    />
                    {textError && <div className='has-error__message'>{textError}</div>}
                </div>
                <div className='form-group'>
                    <label htmlFor='linkModalURL'>
                        <FormattedMessage
                            id='link_modal.url_label'
                            defaultMessage='Link URL'
                        />
                    </label>
                    <input
                        id='linkModalURL'
                        className={classNames('form-control', {'has-error': urlError})}
                        type='url'
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus={Boolean(initialText)} // Focus URL field if text is pre-filled
                        placeholder='https://example.com'
                    />
                    {urlError && <div className='has-error__message'>{urlError}</div>}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    id='linkModalCancelButton'
                    type='button'
                    className='btn btn-tertiary'
                    onClick={handleHide}
                >
                    <FormattedMessage
                        id='link_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    id='linkModalInsertButton'
                    type='button'
                    className='btn btn-primary'
                    onClick={handleSubmit}
                    disabled={!url.trim() || !displayText.trim()}
                >
                    <FormattedMessage
                        id='link_modal.insert'
                        defaultMessage='Insert'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
}