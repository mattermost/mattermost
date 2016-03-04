// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../utils/constants.jsx';
import GetLinkModal from './get_link_modal.jsx';
import ModalStore from '../stores/modal_store.jsx';
import TeamStore from '../stores/team_store.jsx';

import {intlShape, injectIntl, defineMessages} from 'mm-intl';

const holders = defineMessages({
    title: {
        id: 'get_team_invite_link_modal.title',
        defaultMessage: 'Team Invite Link'
    },
    help: {
        id: 'get_team_invite_link_modal.help',
        defaultMessage: 'Send teammates the link below for them to sign-up to this team site. The Team Invite Link can be shared with multiple teammates as it does not change unless it\'s regenerated in Team Settings by a Team Admin.'
    },
    helpDisabled: {
        id: 'get_team_invite_link_modal.helpDisabled',
        defaultMessage: 'User creation has been disabled for your team. Please ask your team administrator for details.'
    }
});

class GetTeamInviteLinkModal extends React.Component {
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
        const {formatMessage} = this.props.intl;

        let helpText = formatMessage(holders.helpDisabled);

        if (global.window.mm_config.EnableUserCreation === 'true') {
            helpText = formatMessage(holders.help);
        }

        return (
            <GetLinkModal
                show={this.state.show}
                onHide={() => this.setState({show: false})}
                title={formatMessage(holders.title)}
                helpText={helpText}
                link={TeamStore.getCurrentInviteLink()}
            />
        );
    }
}

GetTeamInviteLinkModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(GetTeamInviteLinkModal);
