// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as React from 'react';

import WebSocketClient from 'client/web_websocket_client';

import IntlProvider from 'components/intl_provider';

import {WebSocketContext} from 'utils/use_websocket';

type Props = {
    children: React.ReactNode;
}

export default function RootProvider(props: Props) {
    return (
        <IntlProvider>
            <WebSocketContext.Provider value={WebSocketClient}>
                {props.children}
            </WebSocketContext.Provider>
        </IntlProvider>
    );
}
