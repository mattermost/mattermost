// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    displayName: 'Setting Upload',
    propTypes: {
        title: React.PropTypes.string.isRequired,
        submit: React.PropTypes.func.isRequired,
        fileTypesAccepted: React.PropTypes.string.isRequired,
        clientError: React.PropTypes.string,
        serverError: React.PropTypes.string,
        helpText: React.PropTypes.string
    },
    getInitialState: function() {
        return {
            clientError: this.props.clientError,
            serverError: this.props.serverError
        };
    },
    componentWillReceiveProps: function() {
        this.setState({
            clientError: this.props.clientError,
            serverError: this.props.serverError
        });
    },
    doFileSelect: function(e) {
        e.preventDefault();
        this.setState({
            clientError: '',
            serverError: ''
        });
    },
    doSubmit: function(e) {
        e.preventDefault();
        var inputnode = this.refs.uploadinput.getDOMNode();
        if (inputnode.files && inputnode.files[0]) {
            this.props.submit(inputnode.files[0]);
        } else {
            this.setState({clientError: 'No file selected.'});
        }
    },
    onFileSelect: function(e) {
        var filename = $(e.target).val();
        if (filename.substring(3, 11) === 'fakepath') {
            filename = filename.substring(12);
        }
        $(e.target).closest('li').find('.file-status').addClass('hide');
        $(e.target).closest('li').find('.file-name').removeClass('hide').html(filename);
    },
    render: function() {
        var clientError = null;
        if (this.state.clientError) {
            clientError = (
                <div className='file-status'>{this.state.clientError}</div>
            );
        }
        var serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='file-status'>{this.state.serverError}</div>
            );
        }
        return (
            <ul className='section-max'>
                <li className='col-xs-12 section-title'>{this.props.title}</li>
                <li className='col-xs-offset-3'>{this.props.helpText}</li>
                <li className='col-xs-offset-3 col-xs-8'>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            <span className='btn btn-sm btn-primary btn-file sel-btn'>Select file<input ref='uploadinput' accept={this.props.fileTypesAccepted} type='file' onChange={this.onFileSelect}/></span>
                            <a
                                className={'btn btn-sm btn-primary'}
                                onClick={this.doSubmit}>
                                Import
                            </a>
                            <div className='file-status file-name hide'></div>
                            {serverError}
                            {clientError}
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
});
