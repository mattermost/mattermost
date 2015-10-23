// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var LoadingScreen = require('../loading_screen.jsx');

export default class UserList extends React.Component {
    constructor(props) {
        super(props);

        this.getData = this.getData.bind(this);

        this.state = {
            users: null,
            serverError: null,
            channel_open_count: null,
            channel_private_count: null,
            post_count: null
        };
    }

    componentDidMount() {
        this.getData(this.props.team.id);
    }

    getData(teamId) {
        Client.getAnalytics(
            teamId,
            'standard',
            (data) => {
                for (var index in data) {
                    if (data[index].name === 'channel_open_count') {
                        this.setState({channel_open_count: data[index].value});
                    }

                    if (data[index].name === 'channel_private_count') {
                        this.setState({channel_private_count: data[index].value});
                    }

                    if (data[index].name === 'post_count') {
                        this.setState({post_count: data[index].value});
                    }
                }
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        Client.getProfilesForTeam(
            teamId,
            (users) => {
                this.setState({users});

                // var memberList = [];
                // for (var id in users) {
                //     if (users.hasOwnProperty(id)) {
                //         memberList.push(users[id]);
                //     }
                // }

                // memberList.sort((a, b) => {
                //     if (a.username < b.username) {
                //         return -1;
                //     }

                //     if (a.username > b.username) {
                //         return 1;
                //     }

                //     return 0;
                // });
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    componentWillReceiveProps(newProps) {
        this.setState({
            users: null,
            serverError: null,
            channel_open_count: null,
            channel_private_count: null,
            post_count: null
        });

        this.getData(newProps.team.id);
    }

    componentWillUnmount() {
    }

    render() {
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var totalCount = (
            <div className='total-count text-center'>
                <div>{'Total Users'}</div>
                <div>{this.state.users == null ? 'Loading...' : Object.keys(this.state.users).length}</div>
            </div>
        );

        var openChannelCount = (
            <div className='total-count text-center'>
                <div>{'Public Groups'}</div>
                <div>{this.state.channel_open_count == null ? 'Loading...' : this.state.channel_open_count}</div>
            </div>
        );

        var openPrivateCount = (
            <div className='total-count text-center'>
                <div>{'Private Groups'}</div>
                <div>{this.state.channel_private_count == null ? 'Loading...' : this.state.channel_private_count}</div>
            </div>
        );

        var postCount = (
            <div className='total-count text-center'>
                <div>{'Total Posts'}</div>
                <div>{this.state.post_count == null ? 'Loading...' : this.state.post_count}</div>
            </div>
        );

        return (
            <div className='wrapper--fixed'>
                <h2>{'Analytics for ' + this.props.team.name}</h2>
                {serverError}
                {totalCount}
                {postCount}
                {openChannelCount}
                {openPrivateCount}
            </div>
        );
    }
}

UserList.propTypes = {
    team: React.PropTypes.object
};
