// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Product} from '@mattermost/types/cloud';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getSelfHostedProducts, getSelfHostedProductsLoaded} from 'mattermost-redux/selectors/entities/hosted_customer';

import {getSelfHostedProducts as getSelfHostedProductsAction} from 'actions/hosted_customer';

import {useIsLoggedIn} from 'components/global_header/hooks';

export default function useGetSelfHostedProducts(): [Record<string, Product>, boolean] {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const isLoggedIn = useIsLoggedIn();
    const products = useSelector(getSelfHostedProducts);
    const productsReceived = useSelector(getSelfHostedProductsLoaded);
    const dispatch = useDispatch();
    const requested = useRef(false);

    useEffect(() => {
        if (isLoggedIn && !isCloud && !requested.current && !productsReceived) {
            dispatch(getSelfHostedProductsAction());
            requested.current = true;
        }
    }, [isLoggedIn, isCloud, productsReceived]);

    const result: [Record<string, Product>, boolean] = useMemo(() => {
        return [products, productsReceived];
    }, [products, productsReceived]);
    return result;
}
