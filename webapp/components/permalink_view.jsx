// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelHeader from 'components/channel_header.jsx';
import PostFocusView from 'components/post_focus_view.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {Link} from 'react-router';
import {FormattedMessage} from 'react-intl';

export default class PermalinkView extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.isStateValid = this.isStateValid.bind(this);
        this.updateState = this.updateState.bind(this);

        this.state = this.getStateFromStores(props);
    }
    getStateFromStores(props) {
        const postId = props.params.postid;
        const channel = ChannelStore.getCurrent();
        const channelId = channel ? channel.id : '';
        const channelName = channel ? channel.name : '';
        const teamURL = TeamStore.getCurrentTeamUrl();
        const profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        return {
            channelId,
            channelName,
            profiles,
            teamURL,
            postId
        };
    }
    isStateValid() {
        return this.state.channelId !== '' && this.state.profiles && this.state.teamURL;
    }
    updateState() {
        this.setState(this.getStateFromStores(this.props));
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.updateState);
        TeamStore.addChangeListener(this.updateState);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.updateState);
        TeamStore.removeChangeListener(this.updateState);
    }
    componentWillReceiveProps(nextProps) {
        this.setState(this.getStateFromStores(nextProps));
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (nextState.postId !== this.state.postId) {
            return true;
        }

        if (nextState.channelId !== this.state.channelId) {
            return true;
        }

        if (nextState.teamURL !== this.state.teamURL) {
            return true;
        }

        return false;
    }
    render() {
        if (!this.isStateValid()) {
            return null;
        }
        return (
            <div
                id='app-content'
                className='app__content'
            >
                <ChannelHeader
                    channelId={this.state.channelId}
                />
                <PostFocusView profiles={this.state.profiles}/>
                <div
                    id='archive-link-home'
                >
                    <Link
                        to={this.state.teamURL + '/channels/' + this.state.channelName}
                    >
                        <FormattedMessage
                            id='center_panel.recent'
                            defaultMessage='Click here to jump to recent messages. '
                        />
                        <i className='fa fa-arrow-down'></i>
                    </Link>
                </div>
            </div>
        );
    }
}

PermalinkView.defaultProps = {
};

PermalinkView.propTypes = {
    params: React.PropTypes.object.isRequired
};
