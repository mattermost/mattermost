// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getCloudContactUsLink, InquiryType, SalesInquiryIssue} from 'selectors/cloud';

export default function useOpenSalesLink(issue?: SalesInquiryIssue, inquireType: InquiryType = InquiryType.Sales) {
    const contactSalesLink = useSelector(getCloudContactUsLink)(inquireType, issue);

    return () => window.open(contactSalesLink, '_blank');
}

