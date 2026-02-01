// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';

import './keypair_prompt_modal.scss';

type Props = {
    onExited: () => void;
    onConfirm: (dontShowAgain: boolean) => void;
    onDismiss: (dontShowAgain: boolean) => void;
}

const KeypairPromptModal = ({onExited, onConfirm, onDismiss}: Props) => {
    const {formatMessage} = useIntl();
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [show, setShow] = useState(true);

    const handleConfirm = () => {
        setShow(false);
        onConfirm(dontShowAgain);
    };

    const handleCancel = () => {
        setShow(false);
        onDismiss(dontShowAgain);
    };

    const headerText = (
        <span className='KeypairPromptModal__header-content'>
            <LockOutlineIcon size={20}/>
            <FormattedMessage
                id='encryption.keypair_prompt.title'
                defaultMessage='Secure Your Messages'
            />
        </span>
    );

    const footerContent = (
        <div className='KeypairPromptModal__footer-content'>
            <div className='KeypairPromptModal__checkbox'>
                <label>
                    <input
                        type='checkbox'
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                    />
                    <FormattedMessage
                        id='encryption.keypair_prompt.dont_show_again'
                        defaultMessage="Don't show me this again"
                    />
                </label>
            </div>
            <div className='KeypairPromptModal__buttons'>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={handleCancel}
                >
                    {formatMessage({id: 'encryption.keypair_prompt.dismiss', defaultMessage: 'Dismiss'})}
                </button>
                <button
                    type='button'
                    className='btn btn-primary'
                    onClick={handleConfirm}
                >
                    {formatMessage({id: 'encryption.keypair_prompt.confirm', defaultMessage: 'Generate Keys'})}
                </button>
            </div>
        </div>
    );

    return (
        <GenericModal
            id='keypairPromptModal'
            className='KeypairPromptModal'
            modalHeaderText={headerText}
            compassDesign={true}
            footerContent={footerContent}
            show={show}
            onExited={onExited}
            onHide={handleCancel}
        >
            <div className='KeypairPromptModal__body'>
                <p className='KeypairPromptModal__description'>
                    <FormattedMessage
                        id='encryption.keypair_prompt.description'
                        defaultMessage='Generate your encryption keys to enable end-to-end encryption for your messages. This ensures that only you and your recipients can read your conversations.'
                    />
                </p>
            </div>
        </GenericModal>
    );
};

export default KeypairPromptModal;
