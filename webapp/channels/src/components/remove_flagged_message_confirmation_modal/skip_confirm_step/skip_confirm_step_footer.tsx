// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import './skip_confirm_step_footer.scss';

type FooterProps = {
    submitting: boolean;
    onBack: () => void;
    onPrimary: () => void;
};

export function SkipConfirmStepFooter({submitting, onBack, onPrimary}: FooterProps) {
    const {formatMessage} = useIntl();

    const backText = formatMessage({id: 'keep_remove_quarantined_content_modal.back.button_text', defaultMessage: 'Back'});
    const primaryText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove_without_report.button_text', defaultMessage: 'Remove without report'});

    return (
        <div className='ModalFooterRow ModalFooterRow--end'>
            <div className='ModalFooterRow__right'>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='tertiary'
                    onClick={onBack}
                    data-testid='skip-confirm-back-button'
                >
                    {backText}
                </Button>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='primary'
                    destructive={true}
                    onClick={onPrimary}
                    disabled={submitting}
                    data-testid='skip-confirm-primary-button'
                >
                    {primaryText}
                </Button>
            </div>
        </div>
    );
}
