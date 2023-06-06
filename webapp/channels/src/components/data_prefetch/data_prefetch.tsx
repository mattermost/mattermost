// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PQueue from 'p-queue';

import {Channel} from '@mattermost/types/channels';

import {Constants} from 'utils/constants';
import {loadProfilesForSidebar} from 'actions/user_actions';

const queue = new PQueue({concurrency: 2});

type Props = {
    currentChannelId: string;
    prefetchQueueObj: Record<string, string[]>;
    prefetchRequestStatus: Record<string, string>;

    // Whether or not the categories in the sidebar have been loaded for the current team
    sidebarLoaded: boolean;

    unreadChannels: Channel[];
    actions: {
        prefetchChannelPosts: (channelId: string, delay?: number) => Promise<any>;
        trackPreloadedChannels: (prefetchQueueObj: Record<string, string[]>) => void;
    };
}

/*
    This component is responsible for prefetching data. As of now component only fetches for channel posts based on the below set of rules.
    * Priority order:
        Fetches channel posts 2 at a time, with mentions followed channels with unreads.

    * Conditions for prefetching posts:
        On load of webapp
        On socket reconnect or system comes from sleep
        On new message in a channel where user has not visited in the present session
        On addition of user to a channel/GM
        On Team switch

        In order to solve the above conditions the component looks for changes in selector unread channels.
        if there is a change in unreads selector, then component clears existing queue as it can be obselete
        i.e there can be new mentions and we need to prioritise instead of unreads so, contructs a new queue
        with dispacthes of unreads posts for channels which do not have prefetched requests.

    * other changes:
        Adds current channel posts requests to be dispatched as soon as it is set in redux state instead of dispatching it from actions down the hierarchy. Otherwise couple of prefetching requests are sent before the postlist makes a request for posts.
        Add a jitter(0-1sec) for delaying post requests in case of a new message in open/private channels. This is to prevent a case when all clients request messages when new post is made in a channel with thousands of users.
*/
export default class DataPrefetch extends React.PureComponent<Props> {
    private prefetchTimeout?: number;

    async componentDidUpdate(prevProps: Props) {
        const {currentChannelId, prefetchQueueObj, sidebarLoaded} = this.props;
        if (currentChannelId && sidebarLoaded && (!prevProps.currentChannelId || !prevProps.sidebarLoaded)) {
            queue.add(async () => this.prefetchPosts(currentChannelId));
            await loadProfilesForSidebar();
            this.prefetchData();
        } else if (prevProps.prefetchQueueObj !== prefetchQueueObj) {
            clearTimeout(this.prefetchTimeout);
            await queue.clear();
            this.prefetchData();
        }

        if (currentChannelId && sidebarLoaded && (!prevProps.currentChannelId || !prevProps.sidebarLoaded)) {
            this.props.actions.trackPreloadedChannels(prefetchQueueObj);
        }
    }

    public prefetchPosts = (channelId: string) => {
        let delay;
        const channel = this.props.unreadChannels.find((unreadChannel) => channelId === unreadChannel.id);
        if (channel && (channel.type === Constants.PRIVATE_CHANNEL || channel.type === Constants.OPEN_CHANNEL)) {
            const isLatestPostInLastMin = (Date.now() - channel.last_post_at) <= 1000;
            if (isLatestPostInLastMin) {
                delay = Math.random() * 1000; // 1ms - 1000ms random wait to not choke server
            }
        }
        return this.props.actions.prefetchChannelPosts(channelId, delay);
    };

    private prefetchData = () => {
        const {prefetchRequestStatus, prefetchQueueObj} = this.props;
        for (const priority in prefetchQueueObj) {
            if (!prefetchQueueObj.hasOwnProperty(priority)) {
                continue;
            }

            const priorityQueue = prefetchQueueObj[priority];
            for (const channelId of priorityQueue) {
                if (!prefetchRequestStatus.hasOwnProperty(channelId)) {
                    queue.add(async () => this.prefetchPosts(channelId));
                }
            }
        }
    };

    render() {
        return null;
    }
}
