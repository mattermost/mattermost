// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getCloudCustomer} from 'mattermost-redux/selectors/entities/cloud';

import {getCloudSupportLink, goToCloudSupportForm} from 'utils/contact_support_sales';

export function useOpenCloudZendeskSupportForm(subject: string, description: string): [() => void, string] {
    const customer = useSelector(getCloudCustomer);
    const customerEmail = customer?.email || '';

    const url = getCloudSupportLink(customerEmail, subject, description, window.location.host);

    const openContactSupport = useCallback(
        () => goToCloudSupportForm(customerEmail, subject, description, window.location.host),
        [customerEmail, subject, description],
    );
    return [openContactSupport, url];
}
