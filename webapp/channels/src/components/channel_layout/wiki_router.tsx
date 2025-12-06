// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';

import {selectChannel} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import ChannelView from 'components/channel_view';

import type {GlobalState} from 'types/store';

type RouteParams = {
    team: string;
    channelId: string;
    wikiId: string;
    pageId?: string;
    draftId?: string;
};

type OwnProps = RouteComponentProps<RouteParams>;

type StateProps = {
    channelExists: boolean;
};

type DispatchProps = {
    selectChannel: (channelId: string) => void;
};

type Props = OwnProps & StateProps & DispatchProps;

class WikiRouter extends React.PureComponent<Props> {
    componentDidMount() {
        const {channelId} = this.props.match.params;
        if (this.props.channelExists) {
            this.props.selectChannel(channelId);
        }
    }

    componentDidUpdate(prevProps: Props) {
        const {channelId, wikiId} = this.props.match.params;

        if (prevProps.match.params.channelId !== channelId && this.props.channelExists) {
            this.props.selectChannel(channelId);
        }

        if (prevProps.match.params.wikiId !== wikiId) {
            this.forceUpdate();
        }
    }

    render() {
        return <ChannelView/>;
    }
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps): StateProps {
    const {channelId} = ownProps.match.params;
    const channel = getChannel(state, channelId);
    return {
        channelExists: Boolean(channel),
    };
}

const mapDispatchToProps = {
    selectChannel,
};

export default connect(mapStateToProps, mapDispatchToProps)(WikiRouter);
