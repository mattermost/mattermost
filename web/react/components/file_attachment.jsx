// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName: "FileAttachment",
    propTypes: {
        filenames: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
        index: React.PropTypes.number.isRequired,
        modalId: React.PropTypes.string.isRequired,
        handleImageClick: React.PropTypes.func
    },
    componentDidMount: function() {
        var filename = this.props.filenames[this.props.index];

        var self = this;

        if (filename) {
            var fileInfo = utils.splitFileLocation(filename);
            if (Object.keys(fileInfo).length === 0) return;

            var type = utils.getFileType(fileInfo.ext);

            // This is a temporary patch to fix issue with old files using absolute paths
            if (fileInfo.path.indexOf("/api/v1/files/get") != -1) {
                fileInfo.path = fileInfo.path.split("/api/v1/files/get")[1];
            }
            fileInfo.path = utils.getWindowLocationOrigin() + "/api/v1/files/get" + fileInfo.path;

            if (type === "image") {
                $('<img/>').attr('src', fileInfo.path+'_thumb.jpg').load(function(path, name){ return function() {
                    $(this).remove();
                    if (name in self.refs) {
                        var imgDiv = self.refs[name].getDOMNode();

                        $(imgDiv).removeClass('post__load');
                        $(imgDiv).addClass('post__image');

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
    render: function() {
        var filenames = this.props.filenames;
        var filename = filenames[this.props.index];

        var fileInfo = utils.splitFileLocation(filename);
        if (Object.keys(fileInfo).length === 0) return null;

        var type = utils.getFileType(fileInfo.ext);

        // This is a temporary patch to fix issue with old files using absolute paths
        if (fileInfo.path.indexOf("/api/v1/files/get") != -1) {
            fileInfo.path = fileInfo.path.split("/api/v1/files/get")[1];
        }
        fileInfo.path = utils.getWindowLocationOrigin() + "/api/v1/files/get" + fileInfo.path;

        var thumbnail;
        if (type === "image") {
            thumbnail = (
                <a className="post-image__thumbnail" href="#" onClick={this.props.handleImageClick}
                    data-img-id={this.props.index} data-toggle="modal" data-target={"#" + this.props.modalId }>
                    <div ref={filename} className="post__load" style={{backgroundImage: 'url(/static/images/load.gif)'}}/>
                </a>
            );
        } else {
            thumbnail = (
                <a href={fileInfo.path + (fileInfo.ext ? "." + fileInfo.ext : "")} download={fileInfo.name + (fileInfo.ext ? "." + fileInfo.ext : "")}>
                    <div className={"file-icon "+utils.getIconClassName(type)}/>
                </a>
            );
        }

        var containerClassName = "post-image__column";
        if (type !== "image") {
            containerClassName += " custom-file";
        }

        // TODO fix the race condition here where the file size may arrive before the rest of the page is rendered
        // asynchronously request the size of the file so that we can display it next to the thumbnail
        utils.getFileSize(fileInfo.path + "." + fileInfo.ext, function(self, _filename) {
            return function(size) {
                if ((_filename + "__size") in self.refs) {
                    self.refs[_filename + "__size"].getDOMNode().innerHTML = " " + utils.fileSizeToString(size);
                }
            }
        }(this, filename));

        return (
            <div className={containerClassName} key={filename}>
                {thumbnail}
                <div className="post-image__details">
                    <div className="post-image__name">{fileInfo.name}</div>
                    <div>
                        <span className="post-image__type">{fileInfo.ext.toUpperCase()}</span>
                        <span className="post-image__size" ref={filename + "__size"}></span>
                    </div>
                </div>
            </div>
        );
    }
});
