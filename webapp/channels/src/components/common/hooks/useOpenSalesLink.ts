// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getCloudCustomer, isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {LicenseLinks} from 'utils/constants';
import {buildMMURL, goToMattermostContactSalesForm} from 'utils/contact_support_sales';

export default function useOpenSalesLink(): [() => void, string] {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const customer = useSelector(getCloudCustomer);
    const currentUser = useSelector(getCurrentUser);
    let customerEmail = '';
    let firstName = '';
    let lastName = '';
    let companyName = '';
    const utmSource = 'mattermost';
    let utmMedium = 'in-product';

    if (isCloud && customer) {
        customerEmail = customer.email || '';
        firstName = customer.contact_first_name || '';
        lastName = customer.contact_last_name || '';
        companyName = customer.name || '';
        utmMedium = 'in-product-cloud';
    } else {
        customerEmail = currentUser?.email || '';
    }

    const contactSalesLink = buildMMURL(LicenseLinks.CONTACT_SALES, firstName, lastName, companyName, customerEmail, utmSource, utmMedium);
    const goToSalesLinkFunc = () => {
        goToMattermostContactSalesForm(firstName, lastName, companyName, customerEmail, utmSource, utmMedium);
    };
    return [goToSalesLinkFunc, contactSalesLink];
}
