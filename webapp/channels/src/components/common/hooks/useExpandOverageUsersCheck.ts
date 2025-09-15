// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

const cta = defineMessage({
    id: 'licensingPage.overageUsersBanner.cta',
    defaultMessage: 'Contact Sales',
});

export const useExpandOverageUsersCheck = () => {
    return {
        cta,
    };
};
