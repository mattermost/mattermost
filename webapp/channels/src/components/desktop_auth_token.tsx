// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {DesktopAuthStatus} from 'utils/desktop_app/auth';

type Props = {
    authStatus: DesktopAuthStatus;
}

const DesktopAuthToken: React.FC<Props> = ({authStatus}: Props) => {
    if (authStatus === DesktopAuthStatus.Polling) {
        return (
            <div>
                {'TODO Desktop Token: Authenticating in the browser, awaiting valid token...'}
            </div>
        );
    }

    if (authStatus === DesktopAuthStatus.Complete) {
        return (
            <div>
                {'TODO Desktop Token: You are now logged in. Returning you to the Desktop App...'}
            </div>
        );
    }

    if (authStatus === DesktopAuthStatus.Expired) {
        return (
            <div>
                {'TODO Desktop Token: Something went wrong. Please log in again.'}
            </div>
        );
    }

    return null;
};

export default DesktopAuthToken;
