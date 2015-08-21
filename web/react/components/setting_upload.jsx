// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    displayName: 'Setting Upload',
    propTypes: {
        title: React.PropTypes.string.isRequired,
        submit: React.PropTypes.func.isRequired,
        fileTypesAccepted: React.PropTypes.string.isRequired,
        clientError: React.PropTypes.string,
        serverError: React.PropTypes.string
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
    doCancel: function(e) {
        e.preventDefault();
        this.refs.uploadinput.getDOMNode().value = '';
        this.setState({
            clientError: '',
            serverError: ''
        });
    },
    render: function() {
        var clientError = null;
        if (this.state.clientError) {
            clientError = (
                <div className='form-group has-error'><label className='control-label'>{this.state.clientError}</label></div>
            );
        }
        var serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>
            );
        }
        return (
            <ul className='section-max'>
                <li className='col-xs-12 section-title'>{this.props.title}</li>
                <li className='col-xs-offset-3 col-xs-8'>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {serverError}
                            {clientError}
                            <span className='btn btn-sm btn-primary btn-file sel-btn'>Select File<input ref='uploadinput' accept={this.props.fileTypesAccepted} type='file' onChange={this.onFileSelect}/></span>
                            <a className={'btn btn-sm btn-primary'} onClick={this.doSubmit}>Import</a>
                            <a className='btn btn-sm theme' href='#' onClick={this.doCancel}>Cancel</a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
});
