// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getCloudCustomer, isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {useExternalLink} from 'components/common/hooks/use_external_link';

import {LicenseLinks} from 'utils/constants';
import {buildMMURL, goToMattermostContactSalesForm} from 'utils/contact_support_sales';

import type {GlobalState} from 'types/store';

export default function useOpenSalesLink(): [() => void, string] {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const customer = useSelector(getCloudCustomer);
    const currentUser = useSelector(getCurrentUser);
    const isCloudPreview = useSelector((state: GlobalState) => {
        return state.entities?.cloud?.subscription?.is_cloud_preview === true;
    });

    let customerEmail = '';
    let firstName = '';
    let lastName = '';
    let companyName = '';

    if (isCloud && customer && !isCloudPreview) {
        customerEmail = customer.email || '';
        firstName = customer.contact_first_name || '';
        lastName = customer.contact_last_name || '';
        companyName = customer.name || '';
    } else if (!isCloudPreview) {
        customerEmail = currentUser?.email || '';
    }

    const [, queryParams] = useExternalLink(LicenseLinks.CONTACT_SALES, 'contact_sales');

    const contactSalesLinkWithForm = buildMMURL(LicenseLinks.CONTACT_SALES, firstName, lastName, companyName, customerEmail, queryParams.utm_source, queryParams.utm_medium);

    const goToSalesLinkFunc = useCallback(() => {
        goToMattermostContactSalesForm(firstName, lastName, companyName, customerEmail, queryParams.utm_source, queryParams.utm_medium);
    }, [firstName, lastName, companyName, customerEmail, queryParams.utm_source, queryParams.utm_medium]);

    return [goToSalesLinkFunc, contactSalesLinkWithForm];
}
