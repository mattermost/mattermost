// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebSocketClient} from '@mattermost/client';
import React from 'react';

export const WebSocketContext = React.createContext<WebSocketClient>(null!);
