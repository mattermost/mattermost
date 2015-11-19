// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
import GetLinkModal from './get_link_modal.jsx';
import ModalStore from '../stores/modal_store.jsx';
import TeamStore from '../stores/team_store.jsx';

export default class GetTeamInviteLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);

        this.state = {
            show: false
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(Constants.ActionTypes.TOGGLE_GET_TEAM_INVITE_LINK_MODAL, this.handleToggle);
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(Constants.ActionTypes.TOGGLE_GET_TEAM_INVITE_LINK_MODAL, this.handleToggle);
    }

    handleToggle(value) {
        this.setState({
            show: value
        });
    }

    render() {
        return (
            <GetLinkModal
                show={this.state.show}
                onHide={() => this.setState({show: false})}
                title='Team Invite Link'
                helpText='Send teammates the link below for them to sign-up to this team site.'
                link={TeamStore.getCurrentInviteLink()}
            />
        );
    }

    static show() {
        AppDispatcher.handleViewAction({
            type: Constants.ActionTypes.TOGGLE_GET_TEAM_INVITE_LINK_MODAL,
            value: true
        });
    }
}
