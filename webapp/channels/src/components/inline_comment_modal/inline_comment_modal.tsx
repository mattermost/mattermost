// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {Modal} from 'react-bootstrap';

import './inline_comment_modal.scss';

type Props = {
    selectedText: string;
    onSubmit: (message: string) => void;
    onExited: () => void;
};

const InlineCommentModal = ({selectedText, onSubmit, onExited}: Props) => {
    const [show, setShow] = useState(true);
    const [message, setMessage] = useState('');

    const handleHide = () => {
        setShow(false);
    };

    const handleSubmit = () => {
        if (message.trim()) {
            onSubmit(message);
            handleHide();
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSubmit();
        }
    };

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            role='dialog'
            aria-labelledby='inlineCommentModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='inlineCommentModalLabel'
                >
                    {'Add Comment'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='InlineCommentModal__content'>
                    <div className='InlineCommentModal__selected-text'>
                        <label>{'Commenting on:'}</label>
                        <blockquote>{selectedText}</blockquote>
                    </div>
                    <div className='InlineCommentModal__input'>
                        <label htmlFor='inline-comment-input'>{'Your comment'}</label>
                        <textarea
                            id='inline-comment-input'
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder='Add your comment...'
                            rows={4}
                            autoFocus={true}
                        />
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={handleHide}
                    data-testid='cancel-button'
                >
                    {'Cancel'}
                </button>
                <button
                    type='button'
                    className='btn btn-primary'
                    onClick={handleSubmit}
                    disabled={!message.trim()}
                    data-testid='inline-comment-submit'
                >
                    {'Comment'}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default InlineCommentModal;
