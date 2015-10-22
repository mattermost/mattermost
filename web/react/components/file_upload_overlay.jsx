// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
                <div className='overlay__circle'>
                    <img
                        className='overlay__files'
                        src='/static/images/filesOverlay.png'
                        alt='Files'
                    />
                    <span><i className='fa fa-upload'></i>{'Drop a file to upload it.'}</span>
                    <img
                        className='overlay__logo'
                        src='/static/images/logoWhite.png'
                        width='100'
                        alt='Logo'
                    />
                </div>
            </div>
        );
    }
}

FileUploadOverlay.propTypes = {
    overlayType: React.PropTypes.string
};
