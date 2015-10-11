// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var ViewImageModal = require('./view_image.jsx');
var FileAttachment = require('./file_attachment.jsx');
var Constants = require('../utils/constants.jsx');

export default class FileAttachmentList extends React.Component {
    constructor(props) {
        super(props);

        this.handleImageClick = this.handleImageClick.bind(this);

        this.state = {showPreviewModal: false, startImgId: 0};
    }
    handleImageClick(indexClicked) {
        this.setState({showPreviewModal: true, startImgId: indexClicked});
    }
    render() {
        var filenames = this.props.filenames;

        var postFiles = [];
        for (var i = 0; i < filenames.length && i < Constants.MAX_DISPLAY_FILES; i++) {
            postFiles.push(
                <FileAttachment
                    key={'file_attachment_' + i}
                    filename={filenames[i]}
                    index={i}
                    handleImageClick={this.handleImageClick}
                />
            );
        }

        return (
            <div>
                <div className='post-image__columns'>
                    {postFiles}
                </div>
                <ViewImageModal
                    show={this.state.showPreviewModal}
                    onModalDismissed={() => this.setState({showPreviewModal: false})}
                    channelId={this.props.channelId}
                    userId={this.props.userId}
                    startId={this.state.startImgId}
                    filenames={filenames}
                />
            </div>
        );
    }
}

FileAttachmentList.propTypes = {

    // a list of file pathes displayed by this
    filenames: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,

    // the channel that this is part of
    channelId: React.PropTypes.string,

    // the user that owns the post that this is attached to
    userId: React.PropTypes.string
};
