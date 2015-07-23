// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ViewImageModal = require('./view_image.jsx');
var FileAttachment = require('./file_attachment.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    displayName: "FileAttachmentList",
    propTypes: {
        filenames: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
        modalId: React.PropTypes.string.isRequired,
        channelId: React.PropTypes.string,
        userId: React.PropTypes.string
    },
    getInitialState: function() {
        return {startImgId: 0};
    },
    render: function() {
        var filenames = this.props.filenames;
        var modalId = this.props.modalId;

        var postFiles = [];
        for (var i = 0; i < filenames.length && i < Constants.MAX_DISPLAY_FILES; i++) {
            postFiles.push(<FileAttachment key={i} filenames={filenames} index={i} modalId={modalId} handleImageClick={this.handleImageClick} />);
        }

        return (
            <div>
                <div className="post-image__columns">
                    {postFiles}
                </div>
                <ViewImageModal
                    channelId={this.props.channelId}
                    userId={this.props.userId}
                    modalId={modalId}
                    startId={this.state.startImgId}
                    imgCount={0}
                    filenames={filenames} />
            </div>
        );
    },
    handleImageClick: function(e) {
        this.setState({startImgId: parseInt($(e.target.parentNode).attr('data-img-id'))});
    }
});
