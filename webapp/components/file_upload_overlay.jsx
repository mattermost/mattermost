// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import React from 'react';

import fileOverlayImage from 'images/filesOverlay.png';
import overlayLogoImage from 'images/logoWhite.png';

export default class FileUploadOverlay extends React.Component {
    render() {
        var overlayClass = 'file-overlay hidden';
        if (this.props.overlayType === 'right') {
            overlayClass += ' right-file-overlay';
        } else if (this.props.overlayType === 'center') {
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
                        <span><i className='fa fa-upload'></i>
                            <FormattedMessage
                                id='upload_overlay.info'
                                defaultMessage='Drop a file to upload it.'
                            />
                        </span>
                        <img
                            className='overlay__logo'
                            src={overlayLogoImage}
                            width='100'
                            alt='Logo'
                        />
                    </div>
                </div>
            </div>
        );
    }
}

FileUploadOverlay.propTypes = {
    overlayType: React.PropTypes.string
};
