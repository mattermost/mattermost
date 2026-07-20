// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import AdminHeader from 'components/widgets/admin_console/admin_header';

const messages = defineMessages({
    title: {id: 'admin.global_attributes.title', defaultMessage: 'Manage Attributes'},
});

export const searchableStrings = [
    messages.title,
];

// Empty shell for MM-69845 (Global Attributes access gate). The isHidden
// predicate in admin_definition.tsx is UI-only visibility, not
// authorization: whichever future story adds real content/an API here
// must carry its own PermissionManageSystem check independently.
const GlobalAttributes: React.FC = () => {
    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'/>
            </div>
        </div>
    );
};

export default GlobalAttributes;
