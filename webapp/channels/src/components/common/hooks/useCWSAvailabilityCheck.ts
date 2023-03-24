// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

export default function useCWSAvailabilityCheck(teamEditionDefaultAllowed: boolean = false) {
    const [canReachCWS, setCanReachCWS] = useState(false);
    const config = useSelector(getConfig);
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    useEffect(() => {
        if (!isEnterpriseReady) {
            return;
        }
        Client4.cwsAvailabilityCheck().then(() => {
            setCanReachCWS(true)
            // server will respond with 400 for Team Edition. If teamEditionDefaultAllowed is true, and we have a 400
            // Set availability to true, so trial requests from team edition can still be initiated in-product
        }).catch((err) => setCanReachCWS(err.status_code === 400 && teamEditionDefaultAllowed));
    }, [isEnterpriseReady]);

    return canReachCWS;
}
