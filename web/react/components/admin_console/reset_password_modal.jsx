// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var Modal = ReactBootstrap.Modal;

export default class ResetPasswordModal extends React.Component {
    constructor(props) {
        super(props);

        this.doSubmit = this.doSubmit.bind(this);
        this.doCancel = this.doCancel.bind(this);

        this.state = {
            serverError: null
        };
    }

    doSubmit(e) {
        e.preventDefault();
        var password = React.findDOMNode(this.refs.password).value;

        if (!password || password.length < 5) {
            this.setState({serverError: 'Please enter at least 5 characters.'});
            return;
        }

        this.setState({serverError: null});

        var data = {};
        data.new_password = password;
        data.name = this.props.team.name;
        data.user_id = this.props.user.id;

        Client.resetPassword(data,
            () => {
                this.props.onModalSubmit(React.findDOMNode(this.refs.password).value);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    doCancel() {
        this.setState({serverError: null});
        this.props.onModalDismissed();
    }

    render() {
        if (this.props.user == null) {
            return <div/>;
        }

        let urlClass = 'input-group input-group--limit';
        let serverError = null;

        if (this.state.serverError) {
            urlClass += ' has-error';
            serverError = <div className='form-group has-error'><p className='input__help error'>{this.state.serverError}</p></div>;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.doCancel}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'Reset Password'}</Modal.Title>
                </Modal.Header>
                <form
                    role='form'
                    className='form-horizontal'
                >
                    <Modal.Body>
                        <div className='form-group'>
                            <div className='col-sm-10'>
                                <div className={urlClass}>
                                    <span
                                        data-toggle='tooltip'
                                        title='New Password'
                                        className='input-group-addon'
                                    >
                                        {'New Password'}
                                    </span>
                                    <input
                                        type='password'
                                        ref='password'
                                        className='form-control'
                                        maxLength='22'
                                        autoFocus={true}
                                        tabIndex='1'
                                    />
                                </div>
                                {serverError}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.doCancel}
                        >
                            {'Close'}
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                            tabIndex='2'
                        >
                            {'Select'}
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

ResetPasswordModal.defaultProps = {
    show: false
};

ResetPasswordModal.propTypes = {
    user: React.PropTypes.object,
    team: React.PropTypes.object,
    show: React.PropTypes.bool.isRequired,
    onModalSubmit: React.PropTypes.func,
    onModalDismissed: React.PropTypes.func
};
