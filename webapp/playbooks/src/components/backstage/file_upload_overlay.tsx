// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useIntl} from 'react-intl';

import MattermostLogo from 'src/components/assets/mattermost_logo_svg';
import filesOverlay from 'src/components/assets/files_overlay.png';

export interface FileUploadOverlayProps {
    message: string;
    show: boolean;
    overlayType: string;
}

export const FileUploadOverlay = (props: FileUploadOverlayProps) => {
    const {formatMessage} = useIntl();

    let overlayClass = 'file-overlay';
    if (!props.show) {
        overlayClass += ' hidden';
    }
    if (props.overlayType === 'right') {
        overlayClass += ' right-file-overlay';
    } else if (props.overlayType === 'center') {
        overlayClass += ' center-file-overlay';
    }

    return (
        <div className={overlayClass}>
            <div className='overlay__indent'>
                <div className='overlay__circle'>
                    <img
                        className='overlay__files'
                        alt={formatMessage({defaultMessage: 'Files'})}
                        src={filesOverlay}
                    />
                    <span>
                        <i className='fa fa-upload'/>
                        {props.message}
                    </span>
                    <MattermostLogo
                        className='overlay__logo'
                        fill='#ffffff'
                        width='100'
                        height='16'
                    />
                </div>
            </div>
        </div>
    );
};
