// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class ViewImagePopoverBar extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        var publicLink = '';
        if (global.window.config.EnablePublicLink === 'true') {
            publicLink = (
                <div>
                    <a
                        href='#'
                        className='public-link text'
                        data-title='Public Image'
                        onClick={this.getPublicLink}
                    >
                        {'Get Public Link'}
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
                <span className='pull-left text'>{'File ' + (this.props.fileId + 1) + ' of ' + this.props.totalFiles}</span>
                <div className='image-links'>
                    {publicLink}
                    <a
                        href={this.props.fileURL}
                        download={this.props.filename}
                        className='text'
                    >
                        {'Download'}
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
    onGetPublicLinkPressed: React.PropTypes.func.isRequired
};
