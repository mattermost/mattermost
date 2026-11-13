// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ChevronLeftIcon from '@mattermost/compass-icons/components/chevron-left';
import ChevronRightIcon from '@mattermost/compass-icons/components/chevron-right';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {FILE_PREVIEW_ICON_BUTTON_CLASS, FILE_PREVIEW_ICON_BUTTON_PROPS} from '../icon_button';

import './file_preview_modal_main_nav.scss';

interface Props {
    fileIndex: number;
    totalFiles: number;
    handlePrev: () => void;
    handleNext: () => void;
}

const FilePreviewModalMainNav: React.FC<Props> = (props: Props) => {
    const {formatMessage} = useIntl();
    const prevLabel = formatMessage({id: 'file_preview_modal_main_nav.prevAriaLabel', defaultMessage: 'Previous file'});
    const nextLabel = formatMessage({id: 'file_preview_modal_main_nav.nextAriaLabel', defaultMessage: 'Next file'});

    const leftArrow = (
        <WithTooltip
            key='previewArrowLeft'
            title={
                <FormattedMessage
                    id='generic.previous'
                    defaultMessage='Previous'
                />
            }
        >
            <IconButton
                id='previewArrowLeft'
                className={`${FILE_PREVIEW_ICON_BUTTON_CLASS} file_preview_modal_main_nav__prev`}
                {...FILE_PREVIEW_ICON_BUTTON_PROPS}
                icon={<Icon glyph={<ChevronLeftIcon/>}/>}
                onClick={props.handlePrev}
                aria-label={prevLabel}
            />
        </WithTooltip>
    );

    const rightArrow = (
        <WithTooltip
            key='previewArrowRight'
            title={
                <FormattedMessage
                    id='generic.next'
                    defaultMessage='Next'
                />
            }
        >
            <IconButton
                id='previewArrowRight'
                className={`${FILE_PREVIEW_ICON_BUTTON_CLASS} file_preview_modal_main_nav__next`}
                {...FILE_PREVIEW_ICON_BUTTON_PROPS}
                icon={<Icon glyph={<ChevronRightIcon/>}/>}
                onClick={props.handleNext}
                aria-label={nextLabel}
            />
        </WithTooltip>
    );
    return (
        <div className='file_preview_modal_main_nav icon-buttons-on-dark'>
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
