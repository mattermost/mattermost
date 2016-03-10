// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';

export default class ViewImagePopoverBar extends React.Component {
    render() {
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
                        <FormattedMessage
                            id='view_image_popover.publicLink'
                            defaultMessage='Get Public Link'
                        />
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
                <span className='pull-left text'>
                    <FormattedMessage
                        id='view_image_popover.file'
                        defaultMessage='File {count} of {total}'
                        values={{
                            count: (this.props.fileId + 1),
                            total: this.props.totalFiles
                        }}
                    />
                </span>
                <div className='image-links'>
                    {publicLink}
                    <a
                        href={this.props.fileURL}
                        download={this.props.filename}
                        className='text'
                        target='_blank'
                    >
                        <FormattedMessage
                            id='view_image_popover.download'
                            defaultMessage='Download'
                        />
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
    show: React.PropTypes.bool.isRequired,
    fileId: React.PropTypes.number.isRequired,
    totalFiles: React.PropTypes.number.isRequired,
    filename: React.PropTypes.string.isRequired,
    fileURL: React.PropTypes.string.isRequired,
    getPublicLink: React.PropTypes.func.isRequired
};
