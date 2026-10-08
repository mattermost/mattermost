// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef, type JSX} from 'react';

import type {Channel} from '@mattermost/types/channels';

import {useStartDMCall} from 'components/call_options_menu';

import {Constants} from 'utils/constants';

import type {CallButtonAction} from 'types/store/plugins';

type Props = {
    pluginCallComponents: CallButtonAction[];
    sidebarOpen: boolean;
    userId: string;
    customButton?: JSX.Element;
    dmChannel?: Channel | null;
};

export default function ProfilePopoverCallButton({pluginCallComponents, sidebarOpen, customButton, dmChannel, userId}: Props) {
    const [clickEnabled, setClickEnabled] = useState(true);
    const prevSidebarOpen = useRef(sidebarOpen);
    const startDMCall = useStartDMCall(userId, dmChannel);

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

    const clickHandler = () => {
        if (clickEnabled) {
            startDMCall();
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
