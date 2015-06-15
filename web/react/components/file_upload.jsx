// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var Constants = require('../utils/constants.jsx');
var ChannelStore = require('../stores/channel_store.jsx');

module.exports = React.createClass({
    handleChange: function() {
        var element = $(this.refs.fileInput.getDOMNode());
        var files = element.prop('files');

        this.props.onUploadError(null);

        //This looks redundant, but must be done this way due to
        //setState being an asynchronous call
        var numFiles = 0;
        for(var i = 0; i < files.length && i <= 20 ; i++) {
            if (files[i].size <= Constants.MAX_FILE_SIZE) {
                numFiles++;
            }
        }

        this.props.setUploads(numFiles);

        for (var i = 0; i < files.length && i <= 20; i++) {
            if (files[i].size > Constants.MAX_FILE_SIZE) {
                this.props.onUploadError("Files must be no more than " + Constants.MAX_FILE_SIZE/1000000 + " MB");
                continue;
            }

            var channel_id = ChannelStore.getCurrentId();

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
                    this.props.setUploads(-1);
                    this.props.onUploadError(err);
                }.bind(this)
            );
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

            //This looks redundant, but must be done this way due to
            //setState being an asynchronous call
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

                self.props.setUploads(numItems);

                for (var i = 0; i < items.length; i++) {
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
                        formData.append('files', file, "Image Pasted at "+d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate()+" "+hour+"-"+min+"." + ext);

                        client.uploadFile(formData,
                            function(data) {
                                parsedData = $.parseJSON(data);
                                self.props.onFileUpload(parsedData['filenames'], channel_id);
                            }.bind(this),
                            function(err) {
                                self.props.onUploadError(err);
                            }.bind(this)
                        );
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
