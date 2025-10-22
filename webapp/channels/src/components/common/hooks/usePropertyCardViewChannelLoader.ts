// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';

import type {Channel} from '@mattermost/types/channels';

import {useChannel} from 'components/common/hooks/useChannel';

export function usePropertyCardViewChannelLoader(channelId?: string, getChannel?: (channelId: string) => Promise<Channel>) {
    const channelLoaded = useRef(false);
    const [channel, setChannel] = useState<Channel>();

    const channelFromStore = useChannel(channelId || '');

    useEffect(() => {
        if (channel && channel.id !== channelId) {
            setChannel(undefined);
            channelLoaded.current = false;
        }
    }, [channel, channelId]);

    useEffect(() => {
        const useChannelFromStore = Boolean(!getChannel && channelFromStore);
        if (useChannelFromStore) {
            setChannel(channelFromStore!);
            channelLoaded.current = true;
            return;
        }

        const loadChannel = async () => {
            const canLoadChannel = !channelLoaded.current && getChannel && channelId && !channel;
            if (!canLoadChannel) {
                return;
            }

            try {
                const fetchedChannel = await getChannel(channelId);
                if (fetchedChannel) {
                    setChannel(fetchedChannel);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log('Error occurred while fetching channel for post preview property renderer', error);
            } finally {
                channelLoaded.current = true;
            }
        };

        loadChannel();
    }, [channel, channelFromStore, channelId, getChannel]);

    return channel;
}
