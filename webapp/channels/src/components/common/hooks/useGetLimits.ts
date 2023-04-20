// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {Limits} from '@mattermost/types/cloud';
import {getSubscriptionProduct, getCloudLimits, getCloudLimitsLoaded, isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getCloudLimits as getCloudLimitsAction} from 'actions/cloud';
import {useIsLoggedIn} from 'components/global_header/hooks';

export default function useGetLimits(): [Limits, boolean] {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const isLoggedIn = useIsLoggedIn();
    const cloudLimits = useSelector(getCloudLimits);
    const cloudLimitsReceived = useSelector(getCloudLimitsLoaded);
    const dispatch = useDispatch();
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const [requestedLimits, setRequestedLimits] = useState(false);

    useEffect(() => {
        if (isLoggedIn && isCloud && !requestedLimits && !cloudLimitsReceived) {
            dispatch(getCloudLimitsAction());
            setRequestedLimits(true);
        }
    }, [isLoggedIn, isCloud, requestedLimits, cloudLimitsReceived]);

    useEffect(() => {
        if (subscriptionProduct && requestedLimits) {
            setRequestedLimits(false);
        }
    }, [subscriptionProduct]);

    const result: [Limits, boolean] = useMemo(() => {
        return [cloudLimits, cloudLimitsReceived];
    }, [cloudLimits, cloudLimitsReceived]);
    return result;
}
