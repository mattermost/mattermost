// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getSelfHostedProducts, getSelfHostedProductsLoaded} from 'mattermost-redux/selectors/entities/hosted_customer';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getSelfHostedProducts as getSelfHostedProductsAction} from 'actions/hosted_customer';
import {useIsLoggedIn} from 'components/global_header/hooks';

import {Product} from '@mattermost/types/cloud';

export default function useGetSelfHostedProducts(): [Record<string, Product>, boolean] {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const isLoggedIn = useIsLoggedIn();
    const products = useSelector(getSelfHostedProducts);
    const productsReceived = useSelector(getSelfHostedProductsLoaded);
    const dispatch = useDispatch();
    const [requested, setRequested] = useState(false);

    useEffect(() => {
        if (isLoggedIn && !isCloud && !requested && !productsReceived) {
            dispatch(getSelfHostedProductsAction());
            setRequested(true);
        }
    }, [isLoggedIn, isCloud, requested, productsReceived]);
    const result: [Record<string, Product>, boolean] = useMemo(() => {
        return [products, productsReceived];
    }, [products, productsReceived]);
    return result;
}
