// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    publicImage: {
        id: 'view_image_popover.publicImage',
        defaultMessage: 'Public Image'
    },
    publicLink: {
        id: 'view_image_popover.publicLink',
        defaultMessage: 'Get Public Link'
    },
    file: {
        id: 'view_image_popover.file',
        defaultMessage: 'File '
    },
    of: {
        id: 'view_image_popover.of',
        defaultMessage: ' of '
    },
    download: {
        id: 'view_image_popover.download',
        defaultMessage: 'Download'
    }
});

class ViewImagePopoverBar extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const {formatMessage} = this.props.intl;
        var publicLink = '';
        if (global.window.mm_config.EnablePublicLink === 'true') {
            publicLink = (
                <div>
                    <a
                        href='#'
                        className='public-link text'
                        data-title='Public Image'
                        onClick={this.props.getPublicLink}
                    >
                        {formatMessage(messages.publicLink)}
                    </a>
                    <span className='text'>{' | '}</span>
                </div>
            );
        }

        var footerClass = 'modal-button-bar';
        if (this.props.show) {
            footerClass += ' footer--show';
        }

        return (
            <div
                ref='imageFooter'
                className={footerClass}
            >
                <span className='pull-left text'>{formatMessage(messages.file) + (this.props.fileId + 1) + formatMessage(messages.of) + this.props.totalFiles}</span>
                <div className='image-links'>
                    {publicLink}
                    <a
                        href={this.props.fileURL}
                        download={this.props.filename}
                        className='text'
                    >
                        {formatMessage(messages.download)}
                    </a>
                </div>
            </div>
        );
    }
}
ViewImagePopoverBar.defaultProps = {
    show: false,
    imgId: 0,
    totalFiles: 0,
    filename: '',
    fileURL: ''
};

ViewImagePopoverBar.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    fileId: React.PropTypes.number.isRequired,
    totalFiles: React.PropTypes.number.isRequired,
    filename: React.PropTypes.string.isRequired,
    fileURL: React.PropTypes.string.isRequired,
    getPublicLink: React.PropTypes.func.isRequired
};

export default injectIntl(ViewImagePopoverBar);