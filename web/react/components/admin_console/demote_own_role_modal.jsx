// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../../utils/async_client.jsx';
import * as Client from '../../utils/client.jsx';
const Modal = ReactBootstrap.Modal;
import * as Utils from '../../utils/utils.jsx';

export default class DemoteOwnRoleModal extends React.Component {
    constructor(props) {
        super(props);

        this.doDemote = this.doDemote.bind(this);
        this.doCancel = this.doCancel.bind(this);

        this.state = {
            serverError: null
        };
    }

    doDemote() {
        const data = {
            user_id: this.props.user.id,
            new_roles: this.props.role
        };
        console.log(JSON.stringify(data));

        Client.updateRoles(data,
            () => {
                this.setState({serverError: null});
                this.props.onModalSubmit();
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
        let serverError = null;

        if (this.state.serverError) {
            serverError = <div className="has-error"><label className="has-error control-label">{this.state.serverError}</label></div>
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.doCancel}
            >
                <Modal.Header closeButton={true}>
                    <h4 className='modal-title'>{'Confirm demotion from System Admin role'}</h4>
                </Modal.Header>
                <Modal.Body>
                    If you demote yourself from the System Admin role and there is not another user with System Admin privileges, you'll need to re-assign a System Admin by accessing the Mattermost server through a terminal and running the following command.<br/><br/>./platform -assign_role -team_name="yourteam" -email="name@yourcompany.com" -role="system_admin"
                    {serverError}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.doCancel}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        data-dismiss='modal'
                        onClick={this.doDemote}
                    >
                        {'Confirm Demotion'}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

DemoteOwnRoleModal.propTypes = {
    user: React.PropTypes.object,
    role: React.PropTypes.string,
    show: React.PropTypes.bool.isRequired,
    onModalSubmit: React.PropTypes.func,
    onModalDismissed: React.PropTypes.func
};
