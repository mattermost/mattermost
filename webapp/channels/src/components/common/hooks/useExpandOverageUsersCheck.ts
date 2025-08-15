// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getExpandSeatsLink} from 'selectors/cloud';

const cta = defineMessage({
    id: 'licensingPage.overageUsersBanner.cta',
    defaultMessage: 'Contact Sales',
});

export const useExpandOverageUsersCheck = () => {
    const expandableLink = useSelector(getExpandSeatsLink);

    return {
        cta,
        expandableLink,
    };
};
