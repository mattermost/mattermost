// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WebSocketClient} from '@mattermost/client';

export const WebSocketContext = React.createContext<WebSocketClient>(null!);
