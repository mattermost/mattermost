// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef} from 'react';
import {useDispatch} from 'react-redux';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import {createDirectChannel} from 'mattermost-redux/actions/channels';

import {Constants} from 'utils/constants';

import type {PluginComponent} from 'types/store/plugins';

type Props = {
    channelMember?: ChannelMembership;
    pluginCallComponents: PluginComponent[];
    sidebarOpen: boolean;
    currentUserId: string;
    userId: string;
    customButton?: JSX.Element;
    dmChannel?: Channel | null;
}

export default function ProfilePopoverCallButton({pluginCallComponents, channelMember, sidebarOpen, customButton, dmChannel, currentUserId, userId}: Props) {
    const [clickEnabled, setClickEnabled] = useState(true);
    const prevSidebarOpen = useRef(sidebarOpen);
    const dispatch = useDispatch();

    useEffect(() => {
        if (prevSidebarOpen.current && !sidebarOpen) {
            setClickEnabled(false);
            setTimeout(() => {
                setClickEnabled(true);
            }, Constants.CHANNEL_HEADER_BUTTON_DISABLE_TIMEOUT);
        }
        prevSidebarOpen.current = sidebarOpen;
    }, [sidebarOpen]);

    if (pluginCallComponents.length === 0) {
        return null;
    }

    const getDmChannel = async () => {
        if (!dmChannel) {
            const {data} = await dispatch(createDirectChannel(currentUserId, userId));
            if (data) {
                return data;
            }
        }
        return dmChannel;
    };

    const item = pluginCallComponents[0];
    const handleStartCall = async () => {
        const channelForCall = await getDmChannel();
        item.action?.(channelForCall, channelMember);
    };
    const clickHandler = async () => {
        if (clickEnabled) {
            handleStartCall();
        }
    };

    return (
        <div
            onClick={clickHandler}
            onTouchEnd={clickHandler}
        >
            {customButton}
        </div>
    );
}
