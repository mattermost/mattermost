// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import './skip_confirm_step_footer.scss';

type FooterProps = {
    action: 'keep' | 'remove';
    submitting: boolean;
    onBack: () => void;
    onPrimary: () => void;
};

export function SkipConfirmStepFooter({action, submitting, onBack, onPrimary}: FooterProps) {
    const {formatMessage} = useIntl();

    const backText = formatMessage({id: 'keep_remove_quarantined_content_modal.back.button_text', defaultMessage: 'Back'});
    const removeText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove_without_report.button_text', defaultMessage: 'Remove without report'});
    const keepText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.button_text', defaultMessage: 'Keep message'});

    const primaryText = action === 'remove' ? removeText : keepText;
    const primaryClass = action === 'remove' ? 'btn-danger' : 'btn-primary';

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
                    className={classNames('GenericModal__button btn', primaryClass)}
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
