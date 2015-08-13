// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var Constants = require('../utils/constants.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName: 'FileUpload',
    propTypes: {
        onUploadError: React.PropTypes.func,
        getFileCount: React.PropTypes.func,
        onFileUpload: React.PropTypes.func,
        onUploadStart: React.PropTypes.func
    },
    getInitialState: function() {
        return {requests: {}};
    },
    handleChange: function() {
        var element = $(this.refs.fileInput.getDOMNode());
        var files = element.prop('files');

        var channelId = this.props.channelId || ChannelStore.getCurrentId();

        this.props.onUploadError(null);

        // This looks redundant, but must be done this way due to
        // setState being an asynchronous call
        var numFiles = 0;
        for (var i = 0; i < files.length; i++) {
            if (files[i].size <= Constants.MAX_FILE_SIZE) {
                numFiles++;
            }
        }

        var numToUpload = Math.min(Constants.MAX_UPLOAD_FILES - this.props.getFileCount(channelId), numFiles);

        if (numFiles > numToUpload) {
            this.props.onUploadError('Uploads limited to ' + Constants.MAX_UPLOAD_FILES + ' files maximum. Please use additional posts for more files.');
        }

        for (var i = 0; i < files.length && i < numToUpload; i++) {
            if (files[i].size > Constants.MAX_FILE_SIZE) {
                this.props.onUploadError('Files must be no more than ' + Constants.MAX_FILE_SIZE / 1000000 + ' MB');
                continue;
            }

            // generate a unique id that can be used by other components to refer back to this file upload
            var clientId = utils.generateId();

            // Prepare data to be uploaded.
            var formData = new FormData();
            formData.append('channel_id', channelId);
            formData.append('files', files[i], files[i].name);
            formData.append('client_ids', clientId);

            var request = client.uploadFile(formData,
                function(data) {
                    var parsedData = $.parseJSON(data);
                    this.props.onFileUpload(parsedData.filenames, parsedData.client_ids, channelId);

                    var requests = this.state.requests;
                    for (var i = 0; i < parsedData.client_ids.length; i++) {
                        delete requests[parsedData.client_ids[i]];
                    }
                    this.setState({requests: requests});
                }.bind(this),
                function(err) {
                    this.props.onUploadError(err, clientId);
                }.bind(this)
            );

            var requests = this.state.requests;
            requests[clientId] = request;
            this.setState({requests: requests});

            this.props.onUploadStart([clientId], channelId);
        }

        // clear file input for all modern browsers
        try {
            element[0].value = '';
            if (element.value) {
                element[0].type = 'text';
                element[0].type = 'file';
            }
        } catch(e) {}
    },
    handleDrop: function(e) {
        this.props.onUploadError(null);

        var files = e.originalEvent.dataTransfer.files;
        if (!files.length) {
            files = e.originalEvent.dataTransfer.getData('URL');
        }
        var channelId = this.props.channelId || ChannelStore.getCurrentId();

        if (typeof files !== 'string' && files.length) {
            var numFiles = files.length;

            var numToUpload = Math.min(Constants.MAX_UPLOAD_FILES - this.props.getFileCount(channelId), numFiles);

            if (numFiles > numToUpload) {
                this.props.onUploadError('Uploads limited to ' + Constants.MAX_UPLOAD_FILES + ' files maximum. Please use additional posts for more files.');
            }

            for (var i = 0; i < files.length && i < numToUpload; i++) {
                if (files[i].size > Constants.MAX_FILE_SIZE) {
                    this.props.onUploadError('Files must be no more than ' + Constants.MAX_FILE_SIZE / 1000000 + ' MB');
                    continue;
                }

                // generate a unique id that can be used by other components to refer back to this file upload
                var clientId = utils.generateId();

                // Prepare data to be uploaded.
                var formData = new FormData();
                formData.append('channel_id', channelId);
                formData.append('files', files[i], files[i].name);
                formData.append('client_ids', clientId);

                var request = client.uploadFile(formData,
                    function(data) {
                        var parsedData = $.parseJSON(data);
                        this.props.onFileUpload(parsedData['filenames'], parsedData['client_ids'], channelId);

                        var requests = this.state.requests;
                        for (var i = 0; i < parsedData['client_ids'].length; i++) {
                            delete requests[parsedData['client_ids'][i]];
                        }
                        this.setState({requests: requests});
                    }.bind(this),
                    function(err) {
                        this.props.onUploadError(err, clientId);
                    }.bind(this)
                );

                var requests = this.state.requests;
                requests[clientId] = request;
                this.setState({requests: requests});

                this.props.onUploadStart([clientId], channelId);
            }
        }
    },
    componentDidMount: function() {
        var inputDiv = this.refs.input.getDOMNode();
        var self = this;

        if (this.props.postType === 'post') {
            $('.app__content').dragster({
                enter: function(dragsterEvent, e) {
                    $('.center-file-overlay').removeClass('invisible');
                    $('.center-file-overlay').addClass('visible');
                },
                leave: function(dragsterEvent, e) {
                    $('.center-file-overlay').removeClass('visible');
                    $('.center-file-overlay').addClass('invisible');
                },
                drop: function(dragsterEvent, e) {
                    $('.center-file-overlay').removeClass('visible');
                    $('.center-file-overlay').addClass('invisible');
                    self.handleDrop(e);
                }
            });
        } else if (this.props.postType === 'comment') {
            $('.post-right__container').dragster({
                enter: function(dragsterEvent, e) {
                    $('.right-file-overlay').removeClass('invisible');
                    $('.right-file-overlay').addClass('visible');
                },
                leave: function(dragsterEvent, e) {
                    $('.right-file-overlay').removeClass('visible');
                    $('.right-file-overlay').addClass('invisible');
                },
                drop: function(dragsterEvent, e) {
                    $('.right-file-overlay').removeClass('visible');
                    $('.right-file-overlay').addClass('invisible');
                    self.handleDrop(e);
                }
            });
        }

        document.addEventListener('paste', function(e) {
            var textarea = $(inputDiv.parentNode.parentNode).find('.custom-textarea')[0];

            if (textarea !== e.target && !$.contains(textarea, e.target)) {
                return;
            }

            self.props.onUploadError(null);

            // This looks redundant, but must be done this way due to
            // setState being an asynchronous call
            var items = e.clipboardData.items;
            var numItems = 0;
            if (items) {
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        var testExt = items[i].type.split('/')[1].toLowerCase();

                        if (Constants.IMAGE_TYPES.indexOf(testExt) < 0) {
                            continue;
                        }

                        numItems++;
                    }
                }

                var numToUpload = Math.min(Constants.MAX_UPLOAD_FILES - self.props.getFileCount(ChannelStore.getCurrentId()), numItems);

                if (numItems > numToUpload) {
                    self.props.onUploadError('Uploads limited to ' + Constants.MAX_UPLOAD_FILES + ' files maximum. Please use additional posts for more files.');
                }

                for (var i = 0; i < items.length && i < numToUpload; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        var file = items[i].getAsFile();

                        var ext = items[i].type.split('/')[1].toLowerCase();

                        if (Constants.IMAGE_TYPES.indexOf(ext) < 0) {
                            continue;
                        }

                        var channelId = this.props.channelId || ChannelStore.getCurrentId();

                        // generate a unique id that can be used by other components to refer back to this file upload
                        var clientId = utils.generateId();

                        var formData = new FormData();
                        formData.append('channel_id', channelId);
                        var d = new Date();
                        var hour;
                        if (d.getHours() < 10) {
                            hour = '0' + d.getHours();
                        } else {
                            hour = String(d.getHours());
                        }
                        var min;
                        if (d.getMinutes() < 10) {
                            min = '0' + d.getMinutes();
                        } else {
                            min = String(d.getMinutes());
                        }

                        var name = 'Image Pasted at ' + d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + ' ' + hour + '-' + min + '.' + ext;
                        formData.append('files', file, name);
                        formData.append('client_ids', clientId);

                        var request = client.uploadFile(formData,
                            function(data) {
                                var parsedData = $.parseJSON(data);
                                self.props.onFileUpload(parsedData.filenames, parsedData.client_ids, channelId);

                                var requests = self.state.requests;
                                for (var i = 0; i < parsedData.client_ids.length; i++) {
                                    delete requests[parsedData.client_ids[i]];
                                }
                                self.setState({requests: requests});
                            },
                            function(err) {
                                self.props.onUploadError(err, clientId);
                            }
                        );

                        var requests = self.state.requests;
                        requests[clientId] = request;
                        self.setState({requests: requests});

                        self.props.onUploadStart([clientId], channelId);
                    }
                }
            }
        });
    },
    cancelUpload: function(clientId) {
        var requests = this.state.requests;
        var request = requests[clientId];

        if (request) {
            request.abort();

            delete requests[clientId];
            this.setState({requests: requests});
        }
    },
    render: function() {
        return (
            <span ref='input' className='btn btn-file'>
                <span>
                    <i className='glyphicon glyphicon-paperclip' />
                </span>
                <input ref='fileInput' type='file' onChange={this.handleChange} multiple/>
            </span>
        );
    }
});
