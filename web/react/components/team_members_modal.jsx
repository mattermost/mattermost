// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MemberListTeam from './member_list_team.jsx';
import TeamStore from '../stores/team_store.jsx';

const Modal = ReactBootstrap.Modal;

export default class TeamMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.onShow = this.onShow.bind(this);
    }

    componentDidMount() {
        if (this.props.show) {
            this.onShow();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
    }

    onShow() {
        $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 50);
        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
        }
    }

    render() {
        const team = TeamStore.getCurrent();

        return (
            <Modal
                dialogClassName='team-members-modal'
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    {team.display_name + ' Members'}
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    <div className='team-member-list'>
                        <MemberListTeam />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        {'Close'}
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
