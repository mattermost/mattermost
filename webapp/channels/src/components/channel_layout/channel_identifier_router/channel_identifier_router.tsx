// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelView from 'components/channel_view/index';
import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

export interface Match {
    params: {
        identifier: string;
        team: string;
        postid?: string;
        path: string;
    };
    url: string;
}

export type MatchAndHistory = Pick<Props, 'match' | 'history'>

interface Props {
    match: Match;
    actions: {
        onChannelByIdentifierEnter: (props: MatchAndHistory) => any;
    };
    history: any;
}

export default class ChannelIdentifierRouter extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props);

        this.state = {
            prevProps: props,
        };
    }

    private replaceUrlTimeout!: NodeJS.Timeout;

    componentDidUpdate(prevProps: Props) {
        if (this.props.match.params.team !== prevProps.match.params.team ||
            this.props.match.params.identifier !== prevProps.match.params.identifier) {
            clearTimeout(this.replaceUrlTimeout);
            this.props.actions.onChannelByIdentifierEnter(this.props);
            this.replaceUrlIfPermalink();
        }
    }
    componentDidMount() {
        this.props.actions.onChannelByIdentifierEnter(this.props);
        this.replaceUrlIfPermalink();
    }

    componentWillUnmount() {
        clearTimeout(this.replaceUrlTimeout);
    }

    replaceUrlIfPermalink = () => {
        if (this.props.match.params.postid) {
            this.replaceUrlTimeout = setTimeout(() => {
                const channelUrl = this.props.match.url.split('/').slice(0, -1).join('/');
                getHistory().replace(channelUrl);
            }, Constants.PERMALINK_FADEOUT);
        }
    }

    render() {
        return <ChannelView/>;
    }
}
