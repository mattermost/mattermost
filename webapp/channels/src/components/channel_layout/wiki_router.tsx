// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';

import {selectChannel} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {getResolvedChannelId} from 'selectors/pages';

import ChannelView from 'components/channel_view';

import type {GlobalState} from 'types/store';

type RouteParams = {
    team: string;
    wikiId: string;
    pageId?: string;
    draftId?: string;
};

type OwnProps = RouteComponentProps<RouteParams>;

type StateProps = {
    resolvedChannelId: string;
    channelExists: boolean;
};

type DispatchProps = {
    selectChannel: (channelId: string) => void;
};

type Props = OwnProps & StateProps & DispatchProps;

class WikiRouter extends React.PureComponent<Props> {
    componentDidMount() {
        if (this.props.resolvedChannelId && this.props.channelExists) {
            this.props.selectChannel(this.props.resolvedChannelId);
        }
    }

    componentDidUpdate(prevProps: Props) {
        // Fire when the resolved channel id changes OR when the channel becomes
        // known to Redux (resolution can lag the wiki/links arriving from the
        // server). Without the second condition, deep-linked navigations would
        // never sync the sidebar.
        const {resolvedChannelId, channelExists} = this.props;
        if (!resolvedChannelId || !channelExists) {
            return;
        }
        const idChanged = prevProps.resolvedChannelId !== resolvedChannelId;
        const becameKnown = !prevProps.channelExists && channelExists;
        if (idChanged || becameKnown) {
            this.props.selectChannel(resolvedChannelId);
        }
    }

    render() {
        return <ChannelView/>;
    }
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps): StateProps {
    const wikiId = ownProps.match?.params.wikiId ?? '';
    const resolvedChannelId = getResolvedChannelId(state, wikiId);
    const channel = resolvedChannelId ? getChannel(state, resolvedChannelId) : undefined;
    return {
        resolvedChannelId,
        channelExists: Boolean(channel),
    };
}

const mapDispatchToProps = {
    selectChannel,
};

export default connect(mapStateToProps, mapDispatchToProps)(WikiRouter);
