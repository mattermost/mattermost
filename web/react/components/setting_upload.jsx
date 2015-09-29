// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class SettingsUpload extends React.Component {
    constructor(props) {
        super(props);

        this.doFileSelect = this.doFileSelect.bind(this);
        this.doSubmit = this.doSubmit.bind(this);
        this.onFileSelect = this.onFileSelect.bind(this);

        this.state = {
            clientError: this.props.clientError,
            serverError: this.props.serverError,
            fileSelected: ''
        };
    }

    componentWillReceiveProps() {
        this.setState({
            clientError: this.props.clientError,
            serverError: this.props.serverError,
            fileSelected: ''
        });
    }

    doFileSelect(e) {
        e.preventDefault();
        this.setState({
            clientError: '',
            serverError: '',
            fileSelected: ''
        });
    }

    doSubmit(e) {
        e.preventDefault();
        var inputnode = React.findDOMNode(this.refs.uploadinput);
        if (inputnode.files && inputnode.files[0]) {
            this.props.submit(inputnode.files[0]);
        } else {
            this.setState({clientError: 'No file selected.'});
        }
    }

    onFileSelect(e) {
        var filename = $(e.target).val();
        if (filename.substring(3, 11) === 'fakepath') {
            filename = filename.substring(12);
        }
        this.setState({
            fileSelected: filename
        });
    }

    render() {
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
        var fileSelected = (
            <div>
                <span className='btn btn-sm btn-primary btn-file sel-btn'>
                    {'Select file'}
                    <input
                        ref='uploadinput'
                        accept={this.props.fileTypesAccepted}
                        type='file'
                        onChange={this.onFileSelect}
                    />
                </span>
                <a
                    className={'btn btn-sm btn-primary disabled'}
                    onClick={this.doSubmit}
                >
                    {'Import'}
                </a>
                <div className='file-status file-name hidden'></div>
            </div>
        );
        if (this.state.fileSelected) {
            fileSelected = (
                <div>
                    <span className='btn btn-sm btn-primary btn-file sel-btn'>
                        {'Select file'}
                        <input
                            ref='uploadinput'
                            accept={this.props.fileTypesAccepted}
                            type='file'
                            onChange={this.onFileSelect}
                        />
                    </span>
                    <a
                        className={'btn btn-sm btn-primary'}
                        onClick={this.doSubmit}
                    >
                        {'Import'}
                    </a>
                    <div className='file-status file-name'>{this.state.fileSelected}</div>
                </div>
            );
        }
        return (
            <ul className='section-max'>
                <li className='col-sm-12 section-title'>{this.props.title}</li>
                <li className='col-sm-offset-3 col-sm-9'>{this.props.helpText}</li>
                <li className='col-sm-offset-3 col-sm-9'>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {fileSelected}
                            {serverError}
                            {clientError}
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}

SettingsUpload.propTypes = {
    title: React.PropTypes.string.isRequired,
    submit: React.PropTypes.func.isRequired,
    fileTypesAccepted: React.PropTypes.string.isRequired,
    clientError: React.PropTypes.string,
    serverError: React.PropTypes.string,
    helpText: React.PropTypes.object
};
