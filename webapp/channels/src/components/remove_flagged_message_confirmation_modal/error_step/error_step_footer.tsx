// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

type FooterProps = {
    action: 'keep' | 'remove';
    onSkip: () => void;
    onBack: () => void;
};

export default function ErrorStepFooter({action, onSkip, onBack}: FooterProps) {
    const {formatMessage} = useIntl();

    const skipText = formatMessage({id: 'keep_remove_quarantined_content_modal.skip_report_download.button_text', defaultMessage: 'Skip report download'});
    const removePermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.permanent_button_text', defaultMessage: 'Remove permanently'});
    const keepPermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.permanent_button_text', defaultMessage: 'Keep permanently'});
    const backText = formatMessage({id: 'keep_remove_quarantined_content_modal.back.button_text', defaultMessage: 'Back'});

    const permanentText = action === 'remove' ? removePermanentlyText : keepPermanentlyText;
    const permanentDestructive = action === 'remove';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <Button
                    type='button'
                    className='GenericModal__button skipReportBtn'
                    emphasis='tertiary'
                    destructive={true}
                    onClick={onSkip}
                    data-testid='error-skip-button'
                >
                    {skipText}
                </Button>
            </div>
            <div className='ModalFooterRow__right'>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='tertiary'
                    onClick={onBack}
                    data-testid='error-step-back-button'
                >
                    {backText}
                </Button>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='primary'
                    destructive={permanentDestructive}
                    disabled={true}
                    data-testid='error-permanent-button'
                >
                    {permanentText}
                </Button>
            </div>
        </div>
    );
}
