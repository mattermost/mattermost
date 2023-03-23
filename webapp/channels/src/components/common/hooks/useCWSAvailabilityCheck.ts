// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

export default function useCWSAvailabilityCheck() {
    const [canReachCWS, setCanReachCWS] = useState(false);
    const config = useSelector(getConfig);
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    useEffect(() => {
        if (!isEnterpriseReady) {
            return;
        }
        Client4.cwsAvailabilityCheck().then(() => setCanReachCWS(true));
    }, [isEnterpriseReady]);

    return canReachCWS;
}
