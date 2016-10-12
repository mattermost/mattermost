// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as UserAgent from 'utils/user_agent.jsx';

import {localizeMessage} from 'utils/utils.jsx';
import {FormattedMessage} from 'react-intl';

import React from 'react';
import loadingGif from 'images/load.gif';

export default class FilteredChannelList extends React.Component {
    constructor(props) {
        super(props);

        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.createChannelRow = this.createChannelRow.bind(this);
        this.filterChannels = this.filterChannels.bind(this);

        this.state = {
            filter: '',
            joiningChannel: '',
            channels: this.filterChannels(props.channels)
        };
    }

    componentWillReceiveProps(nextProps) {
        // assume the channel list is immutable
        if (this.props.channels !== nextProps.channels) {
            this.setState({
                channels: this.filterChannels(nextProps.channels)
            });
        }
    }

    componentDidMount() {
        // only focus the search box on desktop so that we don't cause the keyboard to open on mobile
        if (!UserAgent.isMobile()) {
            ReactDOM.findDOMNode(this.refs.filter).focus();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.filter !== this.state.filter) {
            $(ReactDOM.findDOMNode(this.refs.channelList)).scrollTop(0);
        }
    }

    handleJoin(channel) {
        this.setState({joiningChannel: channel.id});
        this.props.handleJoin(
            channel,
            () => {
                this.setState({joiningChannel: ''});
            });
    }

    createChannelRow(channel) {
        let joinButton;
        if (this.state.joiningChannel === channel.id) {
            joinButton = (
                <img
                    className='join-channel-loading-gif'
                    src={loadingGif}
                />
            );
        } else {
            joinButton = (
                <button
                    onClick={this.handleJoin.bind(this, channel)}
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='more_channels.join'
                        defaultMessage='Join'
                    />
                </button>
            );
        }

        return (
            <div
                className='more-modal__row'
                key={channel.id}
            >
                <div className='more-modal__details'>
                    <p className='more-modal__name'>{channel.display_name}</p>
                    <p className='more-modal__description'>{channel.purpose}</p>
                </div>
                <div className='more-modal__actions'>
                    {joinButton}
                </div>
            </div>
        );
    }

    filterChannels(channels) {
        if (!this.state || !this.state.filter) {
            return channels;
        }

        return channels.filter((chan) => {
            const filter = this.state.filter.toLowerCase();
            return Boolean((chan.name.toLowerCase().indexOf(filter) !== -1 || chan.display_name.toLowerCase().indexOf(filter) !== -1) && chan.delete_at === 0);
        });
    }

    handleFilterChange(e) {
        this.setState({
            filter: e.target.value
        });
    }

    render() {
        let channels = this.state.channels;

        if (this.state.filter && this.state.filter.length > 0) {
            channels = this.filterChannels(channels);
        }

        let count;
        if (channels.length === this.props.channels.length) {
            count = (
                <FormattedMessage
                    id='filtered_channels_list.count'
                    defaultMessage='{count} {count, plural, =0 {0 channels} one {channel} other {channels}}'
                    values={{
                        count: channels.length
                    }}
                />
            );
        } else {
            count = (
                <FormattedMessage
                    id='filtered_channels_list.countTotal'
                    defaultMessage='{count} {count, plural, =0 {0 channels} one {channel} other {channels}} of {total} Total'
                    values={{
                        count: channels.length,
                        total: this.props.channels.length
                    }}
                />
            );
        }

        return (
            <div className='filtered-user-list'>
                <div className='filter-row'>
                    <div className='col-sm-6'>
                        <input
                            ref='filter'
                            className='form-control filter-textbox'
                            placeholder={localizeMessage('filtered_channels_list.search', 'Search channels')}
                            onInput={this.handleFilterChange}
                        />
                    </div>
                    <div className='col-sm-12'>
                        <span className='channel-count pull-left'>{count}</span>
                    </div>
                </div>
                <div
                    ref='channelList'
                    className='more-modal__list'
                >
                    {channels.map(this.createChannelRow)}
                </div>
            </div>
        );
    }
}

FilteredChannelList.defaultProps = {
    channels: []
};

FilteredChannelList.propTypes = {
    channels: React.PropTypes.arrayOf(React.PropTypes.object),
    handleJoin: React.PropTypes.func.isRequired
};
