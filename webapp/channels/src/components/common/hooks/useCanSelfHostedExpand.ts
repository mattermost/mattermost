// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import {BillingSchemes, SelfHostedProducts} from 'utils/constants';
import {findSelfHostedProductBySku} from 'utils/hosted_customer';
import {isCloudLicense} from 'utils/license_utils';

import useGetSelfHostedProducts from './useGetSelfHostedProducts';

export default function useCanSelfHostedExpand() {
    const [expansionAvailable, setExpansionAvailable] = useState(false);
    const config = useSelector(getConfig);
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const isSalesServeOnly = useSelector(getSubscriptionProduct)?.billing_scheme === BillingSchemes.SALES_SERVE;
    const license = useSelector(getLicense);
    const isCloud = isCloudLicense(license);
    const [products] = useGetSelfHostedProducts();
    const currentProduct = findSelfHostedProductBySku(products, license.SkuShortName);

    // Self Hosted Products never contains a product for starter, additional check is done out of caution.
    const isSelfHostedStarter = currentProduct === null || currentProduct?.sku === SelfHostedProducts.STARTER;

    useEffect(() => {
        if (!isEnterpriseReady) {
            return;
        }
        Client4.getLicenseSelfServeStatus().
            then((res) => {
                setExpansionAvailable(res.is_expandable ?? false);
            }).
            catch(() => {
                setExpansionAvailable(false);
            });
    }, [isEnterpriseReady]);

    return !isCloud && !isSelfHostedStarter && !isSalesServeOnly && expansionAvailable;
}
