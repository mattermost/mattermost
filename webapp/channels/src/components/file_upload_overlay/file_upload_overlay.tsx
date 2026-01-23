// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import fileOverlayImage from 'images/fileOverlay.svg';

import './file_upload_overlay.scss';

export const DropOverlayIdEditPost = 'editPostFileDropOverlay';
export const DropOverlayIdCreateComment = 'createCommentFileDropOverlay';
export const DropOverlayIdCreatePost = 'createPostFileDropOverlay';
export const DropOverlayIdThreads = 'threadView';
export const DropOverlayIdCenterChannel = 'centerChannelFileDropOverlay';
export const DropOverlayIdRHS = 'rhsFileDropOverlay';

type Props = {
    overlayType: string;
    id: string;
    isInEditMode?: boolean;
    direction?: 'horizontal' | 'vertical';
}

export const FileUploadOverlay = (props: Props) => {
    let overlayClass = 'file-overlay hidden';
    if (props.overlayType === 'right') {
        overlayClass += ' right-file-overlay';
    } else if (props.overlayType === 'center') {
        overlayClass += ' center-file-overlay';
    }

    if (props.isInEditMode) {
        overlayClass += ' post_edit_mode';
    }

    const mode = props.direction || 'vertical';

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
                        alt=''
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
