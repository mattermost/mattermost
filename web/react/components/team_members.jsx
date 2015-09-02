// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var MemberListTeam = require('./member_list_team.jsx');
var utils = require('../utils/utils.jsx');

function getStateFromStores() {
    var users = UserStore.getProfiles();
    var memberList = [];
    for (var id in users) {
        if (users.hasOwnProperty(id)) {
            memberList.push(users[id]);
        }
    }

    memberList.sort(function sort(a, b) {
        if (a.username < b.username) {
            return -1;
        }

        if (a.username > b.username) {
            return 1;
        }

        return 0;
    });

    return {
        member_list: memberList
    };
}

export default class TeamMembers extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);

        this.state = getStateFromStores();
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onChange);

        var self = this;
        $(React.findDOMNode(this.refs.modal)).on('hidden.bs.modal', function show() {
            self.setState({render_members: false});
        });

        $(React.findDOMNode(this.refs.modal)).on('show.bs.modal', function hide() {
            self.setState({render_members: true});
        });
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
    }

    onChange() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }

    render() {
        var serverError = null;

        if (this.state.server_error) {
            serverError = <label className='has-error control-label'>{this.state.server_error}</label>;
        }

        var renderMembers = '';

        if (this.state.render_members) {
            renderMembers = <MemberListTeam users={this.state.member_list} />;
        }

        return (
            <div
                className='modal fade'
                ref='modal'
                id='team_members'
                tabIndex='-1'
                role='dialog'
                aria-hidden='true'
            >
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                                aria-label='Close'
                            >
                                <span aria-hidden='true'>×</span>
                            </button>
                            <h4
                                className='modal-title'
                                id='myModalLabel'
                            >{this.props.teamDisplayName + ' Members'}</h4>
                        </div>
                        <div
                            ref='modalBody'
                            className='modal-body'
                        >
                            <div className='channel-settings'>
                                <div className='team-member-list'>
                                    {renderMembers}
                                </div>
                                {serverError}
                            </div>
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >Close</button>
                        </div>
                    </div>
               </div>
            </div>
        );
    }
}

TeamMembers.propTypes = {
    teamDisplayName: React.PropTypes.string
};
