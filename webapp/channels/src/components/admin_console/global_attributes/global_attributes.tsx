// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import AdminHeader from 'components/widgets/admin_console/admin_header';

const messages = defineMessages({
    title: {id: 'admin.global_attributes.title', defaultMessage: 'Manage Attributes'},
    placeholder: {id: 'admin.global_attributes.placeholder', defaultMessage: 'Global attributes will be here.'},
});

export const searchableStrings = [
    messages.title,
];

const GlobalAttributes: React.FC = () => {
    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <FormattedMessage {...messages.placeholder}/>
                </div>
            </div>
        </div>
    );
};

export default GlobalAttributes;
