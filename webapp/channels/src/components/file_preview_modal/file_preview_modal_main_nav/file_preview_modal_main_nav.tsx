// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import './file_preview_modal_main_nav.scss';

import WithTooltip from 'components/with_tooltip';

interface Props {
    fileIndex: number;
    totalFiles: number;
    handlePrev: () => void;
    handleNext: () => void;
}

const FilePreviewModalMainNav: React.FC<Props> = (props: Props) => {
    const {formatMessage} = useIntl();
    const leftArrow = (
        <WithTooltip
            key='previewArrowLeft'
            title={
                <FormattedMessage
                    id='generic.close'
                    defaultMessage='Close'
                />
            }
        >
            <button
                id='previewArrowLeft'
                className='file_preview_modal_main_nav__prev'
                onClick={props.handlePrev}
                aria-label={formatMessage({id: 'file_preview_modal_main_nav.prevAriaLabel', defaultMessage: 'Previous file'})}
            >
                <i className='icon icon-chevron-left'/>
            </button>
        </WithTooltip>
    );

    const rightArrow = (
        <WithTooltip
            key='publicLink'
            title={
                <FormattedMessage
                    id='generic.next'
                    defaultMessage='Next'
                />
            }
        >
            <button
                id='previewArrowRight'
                className='file_preview_modal_main_nav__next'
                onClick={props.handleNext}
                aria-label={formatMessage({id: 'file_preview_modal_main_nav.nextAriaLabel', defaultMessage: 'Next file'})}
            >
                <i className='icon icon-chevron-right'/>
            </button>
        </WithTooltip>
    );
    return (
        <div className='file_preview_modal_main_nav'>
            {leftArrow}
            <span
                className='modal-bar-file-count'
                aria-live='polite'
                aria-atomic='true'
            >
                <FormattedMessage
                    id='file_preview_modal_main_nav.file'
                    defaultMessage='{count, number} of {total, number}'
                    values={{
                        count: (props.fileIndex + 1),
                        total: props.totalFiles,
                    }}
                />
            </span>
            {rightArrow}
        </div>
    );
};

export default memo(FilePreviewModalMainNav);
