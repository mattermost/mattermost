// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

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
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onBack}
                    data-testid='skip-confirm-back-button'
                >
                    {backText}
                </button>
                <button
                    type='button'
                    className='GenericModal__button btn btn-danger'
                    onClick={onPrimary}
                    disabled={submitting}
                    data-testid='skip-confirm-primary-button'
                >
                    {primaryText}
                </button>
            </div>
        </div>
    );
}
