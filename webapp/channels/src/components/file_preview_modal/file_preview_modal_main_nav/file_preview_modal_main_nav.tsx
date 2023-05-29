// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import './file_preview_modal_main_nav.scss';

import OverlayTrigger from '../../overlay_trigger';
import Tooltip from '../../tooltip';
import Constants from '../../../utils/constants';

interface Props {
    fileIndex: number;
    totalFiles: number;
    handlePrev: () => void;
    handleNext: () => void;
}

const FilePreviewModalMainNav: React.FC<Props> = (props: Props) => {
    const leftArrow = (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            key='previewArrowLeft'
            placement='bottom'
            overlay={
                <Tooltip id='close-icon-tooltip'>
                    <FormattedMessage
                        id='generic.close'
                        defaultMessage='Close'
                    />
                </Tooltip>
            }
        >
            <button
                id='previewArrowLeft'
                className='file_preview_modal_main_nav__prev'
                onClick={props.handlePrev}
            >
                <i className='icon icon-chevron-left'/>
            </button>
        </OverlayTrigger>
    );

    const rightArrow = (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            key='publicLink'
            placement='bottom'
            overlay={
                <Tooltip id='close-icon-tooltip'>
                    <FormattedMessage
                        id='generic.next'
                        defaultMessage='Next'
                    />
                </Tooltip>
            }
        >
            <button
                id='previewArrowRight'
                className='file_preview_modal_main_nav__next'
                onClick={props.handleNext}
            >
                <i className='icon icon-chevron-right'/>
            </button>
        </OverlayTrigger>
    );
    return (
        <div className='file_preview_modal_main_nav'>
            {leftArrow}
            <span className='modal-bar-file-count'>
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
