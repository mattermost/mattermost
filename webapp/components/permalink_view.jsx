// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

import ChannelHeader from 'components/channel_header.jsx';
import PostFocusViewController from 'components/post_view/post_focus_view_controller.jsx';

import ChannelStore from 'stores/channel_store.jsx';
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
        const team = TeamStore.getCurrent();
        const teamName = team ? team.name : '';
        return {
            channelId,
            channelName,
            teamName,
            postId
        };
    }
    isStateValid() {
        return this.state.channelId !== '' && this.state.teamName;
    }
    updateState() {
        this.setState(this.getStateFromStores(this.props));
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.updateState);
        TeamStore.addChangeListener(this.updateState);

        $('body').addClass('app__body');
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.updateState);
        TeamStore.removeChangeListener(this.updateState);

        $('body').removeClass('app__body');
    }
    componentWillReceiveProps(nextProps) {
        this.setState(this.getStateFromStores(nextProps));
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
                <PostFocusViewController/>
                <div
                    id='archive-link-home'
                >
                    <Link
                        to={'/' + this.state.teamName + '/channels/' + this.state.channelName}
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

PermalinkView.propTypes = {
    params: React.PropTypes.object.isRequired
};
