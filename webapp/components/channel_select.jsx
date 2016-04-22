// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Constants from 'utils/constants.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import * as Utils from 'utils/utils.jsx';

export default class ChannelSelect extends React.Component {
    static get propTypes() {
        return {
            onChange: React.PropTypes.func,
            value: React.PropTypes.string
        };
    }

    constructor(props) {
        super(props);

        this.handleChannelChange = this.handleChannelChange.bind(this);

        this.state = {
            channels: []
        };
    }

    componentWillMount() {
        this.setState({
            channels: ChannelStore.getAll()
        });

        ChannelStore.addChangeListener(this.handleChannelChange);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.handleChannelChange);
    }

    handleChannelChange() {
        this.setState({
            channels: ChannelStore.getAll()
        });
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
            if (channel.type === Constants.OPEN_CHANNEL) {
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
