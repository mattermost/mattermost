// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var Constants = require('../utils/constants.jsx');
var ChannelStore = require('../stores/channel_store.jsx');

module.exports = React.createClass({
    handleChange: function() {
        var element = $(this.refs.fileInput.getDOMNode());
        var files = element.prop('files');

        var channel_id = ChannelStore.getCurrentId();

        this.props.onUploadError(null);

        // This looks redundant, but must be done this way due to
        // setState being an asynchronous call
        var numFiles = 0;
        for(var i = 0; i < files.length; i++) {
            if (files[i].size <= Constants.MAX_FILE_SIZE) {
                numFiles++;
            }
        }

        var numToUpload = Math.min(Constants.MAX_UPLOAD_FILES - this.props.getFileCount(channel_id), numFiles);

        if (numFiles > numToUpload) {
            this.props.onUploadError("Uploads limited to " + Constants.MAX_UPLOAD_FILES + " files maximum. Please use additional posts for more files.");
        }

        for (var i = 0; i < files.length && i < numToUpload; i++) {
            if (files[i].size > Constants.MAX_FILE_SIZE) {
                this.props.onUploadError("Files must be no more than " + Constants.MAX_FILE_SIZE/1000000 + " MB");
                continue;
            }

            // Prepare data to be uploaded.
            formData = new FormData();
            formData.append('channel_id', channel_id);
            formData.append('files', files[i], files[i].name);

            client.uploadFile(formData,
                function(data) {
                    parsedData = $.parseJSON(data);
                    this.props.onFileUpload(parsedData['filenames'], channel_id);
                }.bind(this),
                function(err) {
                    this.props.onUploadError(err);
                }.bind(this)
            );

            this.props.onUploadStart([files[i].name], channel_id);
        }

        // clear file input for all modern browsers
        try{
            element[0].value = '';
            if(element.value){
                element[0].type = "text";
                element[0].type = "file";
            }
        }catch(e){}
    },
    componentDidMount: function() {
        var inputDiv = this.refs.input.getDOMNode();
        var self = this;

        document.addEventListener("paste", function(e) {
            var textarea = $(inputDiv.parentNode.parentNode).find('.custom-textarea')[0];

            if (textarea != e.target && !$.contains(textarea,e.target)) {
                return;
            }

            self.props.onUploadError(null);

            // This looks redundant, but must be done this way due to
            // setState being an asynchronous call
            var items = e.clipboardData.items;
            var numItems = 0;
            if (items) {
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") !== -1) {

                        ext = items[i].type.split("/")[1].toLowerCase();
                        ext = ext == 'jpeg' ? 'jpg' : ext;

                        if (Constants.IMAGE_TYPES.indexOf(ext) < 0) return;

                        numItems++
                    }
                }

                var numToUpload = Math.min(Constants.MAX_UPLOAD_FILES - self.props.getFileCount(channel_id), numItems);

                if (numItems > numToUpload) {
                    self.props.onUploadError("Uploads limited to " + Constants.MAX_UPLOAD_FILES + " files maximum. Please use additional posts for more files.");
                }

                for (var i = 0; i < items.length && i < numToUpload; i++) {
                    if (items[i].type.indexOf("image") !== -1) {
                        var file = items[i].getAsFile();

                        ext = items[i].type.split("/")[1].toLowerCase();
                        ext = ext == 'jpeg' ? 'jpg' : ext;

                        if (Constants.IMAGE_TYPES.indexOf(ext) < 0) return;

                        var channel_id = ChannelStore.getCurrentId();

                        formData = new FormData();
                        formData.append('channel_id', channel_id);
                        var d = new Date();
                        var hour = d.getHours() < 10 ? "0" + d.getHours() : String(d.getHours());
                        var min = d.getMinutes() < 10 ? "0" + d.getMinutes() : String(d.getMinutes());
                        var name = "Image Pasted at "+d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate()+" "+hour+"-"+min+"." + ext;
                        formData.append('files', file, name);

                        client.uploadFile(formData,
                            function(data) {
                                parsedData = $.parseJSON(data);
                                self.props.onFileUpload(parsedData['filenames'], channel_id);
                            },
                            function(err) {
                                self.props.onUploadError(err);
                            }
                        );

                        self.props.onUploadStart([name], channel_id);
                    }
                }
            }
        });
    },
    render: function() {
        return (
            <span ref="input" className="btn btn-file"><span><i className="glyphicon glyphicon-paperclip"></i></span><input ref="fileInput" type="file" onChange={this.handleChange} multiple/></span>
        );
    }
});
