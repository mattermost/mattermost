// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getCloudCustomer} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getCloudSupportLink, getSelfHostedSupportLink, goToCloudSupportForm, goToSelfHostedSupportForm} from 'utils/contact_support_sales';

export function useOpenCloudZendeskSupportForm(subject: string, description: string): [() => void, string] {
    const customer = useSelector(getCloudCustomer);
    const customerEmail = customer?.email || '';

    const url = getCloudSupportLink(customerEmail, subject, description, window.location.host);

    return [() => goToCloudSupportForm(customerEmail, subject, description, window.location.host), url];
}

export function useOpenSelfHostedZendeskSupportForm(subject: string): [() => void, string] {
    const currentUser = useSelector(getCurrentUser);
    const customerEmail = currentUser.email || '';

    const url = getSelfHostedSupportLink(customerEmail, subject);

    return [() => goToSelfHostedSupportForm(customerEmail, subject), url];
}
