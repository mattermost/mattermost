// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import GetLinkModal from './get_link_modal.jsx';
import ModalStore from 'stores/modal_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

export default class GetTeamInviteLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

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
        let helpText;
        if (global.window.mm_config.EnableUserCreation === 'true') {
            helpText = Utils.localizeMessage('get_team_invite_link_modal.help', 'Send teammates the link below for them to sign-up to this team site. The Team Invite Link can be shared with multiple teammates as it does not change unless it\'s regenerated in Team Settings by a Team Admin.');
        } else {
            helpText = Utils.localizeMessage('get_team_invite_link_modal.helpDisabled', 'User creation has been disabled for your team. Please ask your team administrator for details.');
        }

        return (
            <GetLinkModal
                show={this.state.show}
                onHide={() => this.setState({show: false})}
                title={Utils.localizeMessage('get_team_invite_link_modal.title', 'Team Invite Link')}
                helpText={helpText}
                link={TeamStore.getCurrentInviteLink()}
            />
        );
    }
}
