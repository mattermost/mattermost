// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from 'utils/utils.jsx';
import {getCountsStateFromStores} from 'utils/channel_utils.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import React from 'react';

export default class NotifyCounts extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = getCountsStateFromStores();
        this.mounted = false;
    }
    componentDidMount() {
        this.mounted = true;
        ChannelStore.addChangeListener(this.onListenerChange);
        TeamStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        this.mounted = false;
        ChannelStore.removeChangeListener(this.onListenerChange);
        TeamStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        if (this.mounted) {
            var newState = getCountsStateFromStores();
            if (!utils.areObjectsEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    }
    render() {
        if (this.state.mentionCount) {
            return <span className='badge badge-notify'>{this.state.mentionCount}</span>;
        } else if (this.state.messageCount) {
            return <span className='badge badge-notify'>{'•'}</span>;
        }
        return null;
    }
}
