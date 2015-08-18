// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var SettingUpload = require('./setting_upload.jsx');

module.exports = React.createClass({
    displayName: 'Import Tab',
    getInitialState: function() {
        return {status: 'ready'};
    },
    onImportFailure: function() {
        this.setState({status: 'fail'});
    },
    onImportSuccess: function() {
        this.setState({status: 'done'});
    },
    doImportSlack: function(file) {
        this.setState({status: 'in-progress'});
        utils.importSlack(file, this.onImportSuccess, this.onImportFailure);
    },
    render: function() {
        var uploadSection = (
            <SettingUpload
                title='Import from Slack'
                submit={this.doImportSlack}
                fileTypesAccepted='.zip'/>
        );

        var messageSection;
        switch (this.state.status) {
            case 'ready':
                messageSection = '';
            break;
            case 'in-progress':
                messageSection = (
                    <p>Importing...</p>
            );
            break;
            case 'done':
                messageSection = (
                    <p>Import sucessfull: <a href={this.state.link} download='MattermostImportSummery.txt'>View Summery</a></p>
            );
            break;
            case 'fail':
                messageSection = (
                    <p>Import failure: <a href={this.state.link} download='MattermostImportSummery.txt'>View Summery</a></p>
            );
            break;
        }

        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>Import</h4>
                </div>
                <div ref='wrapper' className='user-settings'>
                    <h3 className='tab-header'>Import</h3>
                    <div className='divider-dark first'/>
                    {uploadSection}
                    {messageSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
});
