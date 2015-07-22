// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    handleRemove: function(e) {
        var previewDiv = e.target.parentNode.parentNode;
        this.props.onRemove(previewDiv.getAttribute('data-filename'));
    },
    render: function() {
        var previews = [];
        this.props.files.forEach(function(filename) {

            var originalFilename = filename;
            var filenameSplit = filename.split('.');
            var ext = filenameSplit[filenameSplit.length-1];
            var type = utils.getFileType(ext);
            // This is a temporary patch to fix issue with old files using absolute paths
            if (filename.indexOf("/api/v1/files/get") != -1) {
                filename = filename.split("/api/v1/files/get")[1];
            }
            filename = window.location.origin + "/api/v1/files/get" + filename;

            if (type === "image") {
                previews.push(
                    <div key={filename} className="preview-div" data-filename={originalFilename}>
                        <img className="preview-img" src={filename}/>
                        <a className="remove-preview" onClick={this.handleRemove}><i className="glyphicon glyphicon-remove"/></a>
                    </div>
                );
            } else {
                previews.push(
                    <div key={filename} className="preview-div custom-file" data-filename={originalFilename}>
                        <div className={"file-icon "+utils.getIconClassName(type)}/>
                        <a className="remove-preview" onClick={this.handleRemove}><i className="glyphicon glyphicon-remove"/></a>
                    </div>
                );
            }
        }.bind(this));

        for (var i = 0; i < this.props.uploadsInProgress; i++) {
            previews.push(
                <div className="preview-div">
                    <img className="spinner" src="/static/images/load.gif"/>
                </div>
            );
        }

        return (
            <div className="preview-container">
                {previews}
            </div>
        );
    }
});
