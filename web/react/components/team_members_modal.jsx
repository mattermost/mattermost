// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MemberListTeam from './member_list_team.jsx';
import TeamStore from '../stores/team_store.jsx';
import * as Utils from '../utils/utils.jsx';

import {FormattedMessage} from 'mm-intl';

const Modal = ReactBootstrap.Modal;

export default class TeamMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.teamChanged = this.teamChanged.bind(this);

        this.state = {
            team: TeamStore.getCurrent()
        };
    }
    componentDidMount() {
        if (this.props.show) {
            this.onShow();
        }

        TeamStore.addChangeListener(this.teamChanged);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.teamChanged);
    }

    teamChanged() {
        this.setState({team: TeamStore.getCurrent()});
    }

    render() {
        let teamDisplayName = '';
        if (this.state.team) {
            teamDisplayName = this.state.team.display_name;
        }

        let maxHeight = 1000;
        if (Utils.windowHeight() <= 1200) {
            maxHeight = Utils.windowHeight() - 300;
        }

        return (
            <Modal
                dialogClassName='more-modal'
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <FormattedMessage
                        id='team_member_modal.members'
                        defaultMessage='{team} Members'
                        values={{
                            team: teamDisplayName
                        }}
                    />
                </Modal.Header>
                <Modal.Body>
                    <MemberListTeam style={{maxHeight}}/>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        <FormattedMessage
                            id='team_member_modal.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

TeamMembersModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};
