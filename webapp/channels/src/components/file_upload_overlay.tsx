// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import fileOverlayImage from 'images/filesOverlay.png';
import overlayLogoImage from 'images/logoWhite.png';

import {t} from 'utils/i18n';

import LocalizedIcon from './localized_icon';

type Props = {
    overlayType: string;
}

const FileUploadOverlay: React.FC<Props> = (props: Props) => {
    let overlayClass = 'file-overlay hidden';
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
                        src={fileOverlayImage}
                        alt='Files'
                    />
                    <span>
                        <LocalizedIcon
                            className='fa fa-upload'
                            title={{id: t('generic_icons.upload'), defaultMessage: 'Upload Icon'}}
                        />
                        <FormattedMessage
                            id='upload_overlay.info'
                            defaultMessage='Drop a file to upload it.'
                        />
                    </span>
                    <img
                        className='overlay__logo'
                        src={overlayLogoImage}
                        alt='Logo'
                    />
                </div>
            </div>
        </div>
    );
};

export default FileUploadOverlay;
