// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    getCloudSubscription as getCloudSubscriptionAction,
} from 'mattermost-redux/actions/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {Product} from '@mattermost/types/cloud';
import {getCloudSubscription, getCloudProducts, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

export default function useGetSubscription(): Product | undefined {
    const cloudSubscription = useSelector(getCloudSubscription);
    const cloudProducts = useSelector(getCloudProducts);
    const license = useSelector(getLicense);
    const retrievedCloudSub = Boolean(cloudSubscription);
    const retrievedCloudProducts = Boolean(cloudProducts);
    const dispatch = useDispatch();
    const [requestedSubscription, setRequestedSubscription] = useState(false);
    const [requestedProducts, setRequestedProducts] = useState(false);

    useEffect(() => {
        if (license.Cloud === 'true' && !retrievedCloudSub && !requestedSubscription) {
            dispatch(getCloudSubscriptionAction());
            setRequestedSubscription(true);
        }
    }, [requestedSubscription, retrievedCloudSub, license]);
    useEffect(() => {
        if (license.Cloud === 'true' && !retrievedCloudProducts && !requestedProducts) {
            dispatch(getCloudSubscriptionAction());
            setRequestedProducts(true);
        }
    }, [requestedProducts, retrievedCloudProducts, license]);

    return useSelector(getSubscriptionProduct);
}

