// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    displayName: "FileAttachment",
    canSetState: false,
    propTypes: {
        // a list of file pathes displayed by the parent FileAttachmentList
        filenames: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
        // the index of this attachment preview in the parent FileAttachmentList
        index: React.PropTypes.number.isRequired,
        // the identifier of the modal dialog used to preview files
        modalId: React.PropTypes.string.isRequired,
        // handler for when the thumbnail is clicked
        handleImageClick: React.PropTypes.func
    },
    getInitialState: function() {
        return {fileSize: -1};
    },
    componentDidMount: function() {
        this.canSetState = true;

        var filename = this.props.filenames[this.props.index];

        if (filename) {
            var fileInfo = utils.splitFileLocation(filename);
            var type = utils.getFileType(fileInfo.ext);

            // This is a temporary patch to fix issue with old files using absolute paths
            if (fileInfo.path.indexOf("/api/v1/files/get") != -1) {
                fileInfo.path = fileInfo.path.split("/api/v1/files/get")[1];
            }
            fileInfo.path = utils.getWindowLocationOrigin() + "/api/v1/files/get" + fileInfo.path;

            if (type === "image") {
                var self = this;
                $('<img/>').attr('src', fileInfo.path+'_thumb.jpg').load(function(path, name){ return function() {
                    $(this).remove();
                    if (name in self.refs) {
                        var imgDiv = self.refs[name].getDOMNode();

                        $(imgDiv).removeClass('post__load');
                        $(imgDiv).addClass('post__image');

                        var width = this.width || $(this).width();
                        var height = this.height || $(this).height();

                        if (width < Constants.THUMBNAIL_WIDTH
                                && height < Constants.THUMBNAIL_HEIGHT) {
                            $(imgDiv).addClass('small');
                        } else {
                            $(imgDiv).addClass('normal');
                        }

                        var re1 = new RegExp(' ', 'g');
                        var re2 = new RegExp('\\(', 'g');
                        var re3 = new RegExp('\\)', 'g');
                        var url = path.replace(re1, '%20').replace(re2, '%28').replace(re3, '%29');
                        $(imgDiv).css('background-image', 'url('+url+'_thumb.jpg)');
                    }
                }}(fileInfo.path, filename));
            }
        }
    },
    componentWillUnmount: function() {
        // keep track of when this component is mounted so that we can asynchronously change state without worrying about whether or not we're mounted
        this.canSetState = false;
    },
    shouldComponentUpdate: function(nextProps, nextState) {
        // the only time this object should update is when it receives an updated file size which we can usually handle without re-rendering
        if (nextState.fileSize != this.state.fileSize) {
            if (this.refs.fileSize) {
                // update the UI element to display the file size without re-rendering the whole component
                this.refs.fileSize.getDOMNode().innerHTML = utils.fileSizeToString(nextState.fileSize);

                return false;
            } else {
                // we can't find the element that should hold the file size so we must not have rendered yet
                return true;
            }
        } else {
            return true;
        }
    },
    render: function() {
        var filenames = this.props.filenames;
        var filename = filenames[this.props.index];

        var fileInfo = utils.splitFileLocation(filename);
        var type = utils.getFileType(fileInfo.ext);

        var thumbnail;
        if (type === "image") {
            thumbnail = <div ref={filename} className="post__load" style={{backgroundImage: 'url(/static/images/load.gif)'}}/>;
        } else {
            thumbnail = <div className={"file-icon "+utils.getIconClassName(type)}/>;
        }

        var fileSizeString = "";
        if (this.state.fileSize < 0) {
            var self = this;

            // asynchronously request the size of the file so that we can display it next to the thumbnail
            utils.getFileSize(utils.getFileUrl(filename), function(fileSize) {
                if (self.canSetState) {
                    self.setState({fileSize: fileSize});
                }
            });
        } else {
            fileSizeString = utils.fileSizeToString(this.state.fileSize);
        }

        return (
            <div className="post-image__column" key={filename}>
                <a className="post-image__thumbnail" href="#" onClick={this.props.handleImageClick}
                    data-img-id={this.props.index} data-toggle="modal" data-target={"#" + this.props.modalId }>
                    {thumbnail}
                </a>
                <div className="post-image__details">
                    <div className="post-image__name">{decodeURIComponent(utils.getFileName(filename))}</div>
                    <div>
                        <span className="post-image__type">{fileInfo.ext.toUpperCase()}</span>
                        <span className="post-image__size">{fileSizeString}</span>
                    </div>
                </div>
            </div>
        );
    }
});
