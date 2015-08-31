// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ViewImageModal = require('./view_image.jsx');
var FileAttachment = require('./file_attachment.jsx');
var Constants = require('../utils/constants.jsx');

export default class FileAttachmentList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {startImgId: 0};
    }
    render() {
        var filenames = this.props.filenames;
        var modalId = this.props.modalId;

        var postFiles = [];
        for (var i = 0; i < filenames.length && i < Constants.MAX_DISPLAY_FILES; i++) {
            postFiles.push(
                <FileAttachment
                    key={i}
                    filename={filenames[i]}
                    index={i}
                    modalId={modalId}
                    handleImageClick={this.handleImageClick} />
            );
        }

        return (
            <div>
                <div className='post-image__columns'>
                    {postFiles}
                </div>
                <ViewImageModal
                    channelId={this.props.channelId}
                    userId={this.props.userId}
                    modalId={modalId}
                    startId={this.state.startImgId}
                    filenames={filenames} />
            </div>
        );
    }
    handleImageClick(e) {
        this.setState({startImgId: parseInt($(e.target.parentNode).attr('data-img-id'), 10)});
    }
}

FileAttachmentList.propTypes = {

    // a list of file pathes displayed by this
    filenames: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,

    // the identifier of the modal dialog used to preview files
    modalId: React.PropTypes.string.isRequired,

    // the channel that this is part of
    channelId: React.PropTypes.string,

    // the user that owns the post that this is attached to
    userId: React.PropTypes.string
};
