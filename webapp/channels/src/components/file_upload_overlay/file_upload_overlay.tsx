// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import fileOverlayImage from 'images/filesOverlay.png';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import './file_upload_overlay.scss';

type Props = {
    overlayType: string;
    id: string;
    editMode?: boolean;
    mode?: 'horizontal' | 'vertical';
}

const FileUploadOverlay = (props: Props) => {
    let overlayClass = 'file-overlay hidden';
    if (props.overlayType === 'right') {
        overlayClass += ' right-file-overlay';
    } else if (props.overlayType === 'center') {
        overlayClass += ' center-file-overlay';
    }

    if (props.editMode) {
        overlayClass += ' post_edit_mode';
    }

    const mode = props.mode || 'vertical';

    return (
        <div
            id={props.id}
            className={overlayClass}
        >
            <div className='overlay__indent'>
                <div className={classNames('overlay__circle', mode)}>
                    <img
                        className='overlay__files'
                        src={fileOverlayImage}
                        alt='Files'
                        loading='lazy'
                    />
                    <FormattedMessage
                        id='upload_overlay.info'
                        defaultMessage='Drop a file to upload it.'
                    />
                </div>
            </div>
        </div>
    );
};

export default FileUploadOverlay;
