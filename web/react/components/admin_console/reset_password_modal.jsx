// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
var Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    submit: {
        id: 'admin.reset_password.submit',
        defaultMessage: 'Please enter at least 5 characters.'
    },
    reset: {
        id: 'admin.reset_password.reset',
        defaultMessage: 'Reset Password'
    },
    newPassword: {
        id: 'admin.reset_password.newPassword',
        defaultMessage: 'New Password'
    },
    close: {
        id: 'admin.reset_password.close',
        defaultMessage: 'Close'
    },
    select: {
        id: 'admin.reset_password.select',
        defaultMessage: 'Select'
    }
});

class ResetPasswordModal extends React.Component {
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
        const {formatMessage} = this.props.intl;
        var password = ReactDOM.findDOMNode(this.refs.password).value;

        if (!password || password.length < 5) {
            this.setState({serverError: formatMessage(messages.submit)});
            return;
        }

        this.setState({serverError: null});

        var data = {};
        data.new_password = password;
        data.name = this.props.team.name;
        data.user_id = this.props.user.id;

        Client.resetPassword(data,
            () => {
                this.props.onModalSubmit(ReactDOM.findDOMNode(this.refs.password).value);
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
        const {formatMessage} = this.props.intl;
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
                    <Modal.Title>{formatMessage(messages.reset)}</Modal.Title>
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
                                        {formatMessage(messages.newPassword)}
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
                            {formatMessage(messages.close)}
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                            tabIndex='2'
                        >
                            {formatMessage(messages.select)}
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
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    team: React.PropTypes.object,
    show: React.PropTypes.bool.isRequired,
    onModalSubmit: React.PropTypes.func,
    onModalDismissed: React.PropTypes.func
};

export default injectIntl(ResetPasswordModal);