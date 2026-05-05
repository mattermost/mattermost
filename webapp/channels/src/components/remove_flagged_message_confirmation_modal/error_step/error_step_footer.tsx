// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

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
    const permanentClass = action === 'remove' ? 'btn-danger' : 'btn-primary';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary btn-danger skipReportBtn'
                    onClick={onSkip}
                    data-testid='error-skip-button'
                >
                    {skipText}
                </button>
            </div>
            <div className='ModalFooterRow__right'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onBack}
                    data-testid='error-step-back-button'
                >
                    {backText}
                </button>
                <button
                    type='button'
                    className={classNames('GenericModal__button btn', permanentClass)}
                    disabled={true}
                    data-testid='error-permanent-button'
                >
                    {permanentText}
                </button>
            </div>
        </div>
    );
}
