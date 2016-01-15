// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    info: {
        id: 'upload_overlay.info',
        defaultMessage: 'Drop a file to upload it.'
    }
});

class FileUploadOverlay extends React.Component {
    render() {
        const {formatMessage} = this.props.intl;
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
                            src='/static/images/filesOverlay.png'
                            alt='Files'
                        />
                        <span><i className='fa fa-upload'></i>{formatMessage(messages.info)}</span>
                        <img
                            className='overlay__logo'
                            src='/static/images/logoWhite.png'
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
    intl: intlShape.isRequired,
    overlayType: React.PropTypes.string
};

export default injectIntl(FileUploadOverlay);