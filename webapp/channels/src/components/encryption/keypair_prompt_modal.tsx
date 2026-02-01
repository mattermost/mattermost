// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

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

    const handleConfirm = () => {
        onConfirm(dontShowAgain);
    };

    const handleCancel = () => {
        onDismiss(dontShowAgain);
    };

    return (
        <GenericModal
            id='keypairPromptModal'
            className='KeypairPromptModal'
            modalHeaderText={formatMessage({id: 'encryption.keypair_prompt.title', defaultMessage: 'Secure Your Messages'})}
            confirmButtonText={formatMessage({id: 'encryption.keypair_prompt.confirm', defaultMessage: 'Generate Keys'})}
            cancelButtonText={formatMessage({id: 'encryption.keypair_prompt.dismiss', defaultMessage: 'Dismiss'})}
            handleConfirm={handleConfirm}
            handleCancel={handleCancel}
            onExited={onExited}
        >
            <div className='KeypairPromptModal__body'>
                <p>
                    <FormattedMessage
                        id='encryption.keypair_prompt.description'
                        defaultMessage='Generate your encryption keys to enable end-to-end encryption for your messages. This ensures that only you and your recipients can read your conversations.'
                    />
                </p>
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
            </div>
        </GenericModal>
    );
};

export default KeypairPromptModal;
