// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

export enum CSWAvailabilityCheckTypes {
    Available = 'available',
    Unavailable = 'unavailable',
    Pending = 'pending',
    NotApplicable = 'notApplicable',
}

export default function useCWSAvailabilityCheck(): CSWAvailabilityCheckTypes {
    const [cswAvailability, setCSWAvailability] = useState<CSWAvailabilityCheckTypes>(CSWAvailabilityCheckTypes.Pending);

    const config = useSelector(getConfig);
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';

    useEffect(() => {
        async function cwsAvailabilityCheck() {
            try {
                await Client4.cwsAvailabilityCheck();
                setCSWAvailability(CSWAvailabilityCheckTypes.Available);
            } catch (error) {
                setCSWAvailability(CSWAvailabilityCheckTypes.Unavailable);
            }
        }

        if (isEnterpriseReady) {
            cwsAvailabilityCheck();
        } else {
            setCSWAvailability(CSWAvailabilityCheckTypes.NotApplicable);
        }
    }, [isEnterpriseReady]);

    return cswAvailability;
}
