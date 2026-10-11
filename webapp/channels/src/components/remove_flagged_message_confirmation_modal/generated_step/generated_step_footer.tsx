// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

type FooterProps = {
    action: 'keep' | 'remove';
    submitting: boolean;
    onDownloadAgain: () => void;
    onBack: () => void;
    onPermanent: () => void;
};

export default function GeneratedStepFooter({
    action,
    submitting,
    onDownloadAgain,
    onBack,
    onPermanent,
}: FooterProps) {
    const {formatMessage} = useIntl();

    const downloadAgainText = formatMessage({id: 'keep_remove_quarantined_content_modal.download_again.button_text', defaultMessage: 'Download again'});
    const backText = formatMessage({id: 'keep_remove_quarantined_content_modal.back.button_text', defaultMessage: 'Back'});
    const removePermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.permanent_button_text', defaultMessage: 'Remove permanently'});
    const keepPermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.permanent_button_text', defaultMessage: 'Keep permanently'});

    const permanentText = action === 'remove' ? removePermanentlyText : keepPermanentlyText;
    const permanentDestructive = action === 'remove';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='tertiary'
                    onClick={onDownloadAgain}
                    data-testid='generated-download-again-button'
                >
                    {downloadAgainText}
                </Button>
            </div>
            <div className='ModalFooterRow__right'>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='tertiary'
                    onClick={onBack}
                    data-testid='generated-back-button'
                >
                    {backText}
                </Button>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='primary'
                    destructive={permanentDestructive}
                    onClick={onPermanent}
                    disabled={submitting}
                    data-testid='generated-permanent-button'
                >
                    {permanentText}
                </Button>
            </div>
        </div>
    );
}
