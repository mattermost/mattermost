// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Constants from 'utils/constants.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

export default class ChannelSelect extends React.Component {
    static get propTypes() {
        return {
            onChange: React.PropTypes.func,
            value: React.PropTypes.string,
            selectOpen: React.PropTypes.bool.isRequired,
            selectPrivate: React.PropTypes.bool.isRequired,
            selectDm: React.PropTypes.bool.isRequired
        };
    }

    static get defaultProps() {
        return {
            selectOpen: false,
            selectPrivate: false,
            selectDm: false
        };
    }

    constructor(props) {
        super(props);

        this.handleChannelChange = this.handleChannelChange.bind(this);
        this.compareByDisplayName = this.compareByDisplayName.bind(this);

        AsyncClient.getMoreChannels(true);

        this.state = {
            channels: ChannelStore.getAll().sort(this.compareByDisplayName)
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.handleChannelChange);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.handleChannelChange);
    }

    handleChannelChange() {
        this.setState({
            channels: ChannelStore.getAll().concat(ChannelStore.getMoreAll()).sort(this.compareByDisplayName)
        });
    }

    compareByDisplayName(channelA, channelB) {
        return channelA.display_name.localeCompare(channelB.display_name);
    }

    render() {
        const options = [
            <option
                key=''
                value=''
            >
                {Utils.localizeMessage('channel_select.placeholder', '--- Select a channel ---')}
            </option>
        ];

        this.state.channels.forEach((channel) => {
            if (channel.type === Constants.OPEN_CHANNEL && this.props.selectOpen) {
                options.push(
                    <option
                        key={channel.id}
                        value={channel.id}
                    >
                        {channel.display_name}
                    </option>
                );
            } else if (channel.type === Constants.PRIVATE_CHANNEL && this.props.selectPrivate) {
                options.push(
                    <option
                        key={channel.id}
                        value={channel.id}
                    >
                        {channel.display_name}
                    </option>
                );
            } else if (channel.type === Constants.DM_CHANNEL && this.props.selectDm) {
                options.push(
                    <option
                        key={channel.id}
                        value={channel.id}
                    >
                        {channel.display_name}
                    </option>
                );
            }
        });

        return (
            <select
                className='form-control'
                value={this.props.value}
                onChange={this.props.onChange}
            >
                {options}
            </select>
        );
    }
}
