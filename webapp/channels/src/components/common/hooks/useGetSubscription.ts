// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    getCloudSubscription as getCloudSubscriptionAction,
} from 'mattermost-redux/actions/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {Subscription} from '@mattermost/types/cloud';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';

export default function useGetSubscription(): Subscription | undefined {
    const cloudSubscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const retrievedCloudSub = Boolean(cloudSubscription);
    const dispatch = useDispatch();
    const [requestedSubscription, setRequestedSubscription] = useState(false);

    useEffect(() => {
        if (license.Cloud === 'true' && !retrievedCloudSub && !requestedSubscription) {
            dispatch(getCloudSubscriptionAction());
            setRequestedSubscription(true);
        }
    }, [requestedSubscription, retrievedCloudSub, license]);

    return cloudSubscription;
}
