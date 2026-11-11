// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import './form_step_footer.scss';

type FooterProps = {
    action: 'keep' | 'remove';
    downloadReport: boolean;
    submitting: boolean;
    onToggleDownloadReport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCancel: () => void;
    onPrimary: () => void;
};

export function FormStepFooter({
    action,
    downloadReport,
    submitting,
    onToggleDownloadReport,
    onCancel,
    onPrimary,
}: FooterProps) {
    const {formatMessage} = useIntl();

    const cancelText = formatMessage({id: 'generic_modal.cancel', defaultMessage: 'Cancel'});
    const continueText = formatMessage({id: 'keep_remove_quarantined_content_modal.continue.button_text', defaultMessage: 'Continue'});
    const removeText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.button_text', defaultMessage: 'Remove message'});
    const keepText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.button_text', defaultMessage: 'Keep message'});

    const actionText = action === 'remove' ? removeText : keepText;
    const primaryText = downloadReport ? continueText : actionText;
    const primaryDestructive = !downloadReport && action === 'remove';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <label
                    className='download_report_checkbox'
                    data-testid='download-report-checkbox-label'
                >
                    <input
                        type='checkbox'
                        checked={downloadReport}
                        onChange={onToggleDownloadReport}
                        data-testid='download-report-checkbox'
                    />
                    <span>
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.download_report_checkbox.label'
                            defaultMessage='Download quarantined message report'
                        />
                    </span>
                </label>
            </div>
            <div className='ModalFooterRow__right'>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='tertiary'
                    onClick={onCancel}
                    data-testid='form-cancel-button'
                >
                    {cancelText}
                </Button>
                <Button
                    type='button'
                    className='GenericModal__button'
                    emphasis='primary'
                    destructive={primaryDestructive}
                    onClick={onPrimary}
                    disabled={submitting}
                    data-testid='form-primary-button'
                >
                    {primaryText}
                </Button>
            </div>
        </div>
    );
}
