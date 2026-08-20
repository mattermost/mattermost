// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {getHistory} from 'utils/browser_history';

import {ATTRIBUTE_DETAILS_ROUTE} from './constants';
import GlobalAttributesTable from './global_attributes_table';

import './global_attributes.scss';

const messages = defineMessages({
    title: {id: 'admin.global_attributes.title', defaultMessage: 'Manage Attributes'},
    subtitle: {id: 'admin.global_attributes.subtitle', defaultMessage: 'Define an attribute once, then choose which resources can use it.'},
    newAttribute: {id: 'admin.global_attributes.new_attribute', defaultMessage: 'New attribute'},
});

export const searchableStrings = [
    messages.title,
];

const GlobalAttributes: React.FC = () => {
    return (
        <div
            className='wrapper--fixed GlobalAttributes__root'
            data-testid='globalAttributes'
        >
            <AdminHeader>
                <hgroup className='GlobalAttributes__headerGroup'>
                    <FormattedMessage
                        tagName='h1'
                        {...messages.title}
                    />
                    <FormattedMessage
                        tagName='p'
                        {...messages.subtitle}
                    />
                </hgroup>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div
                    className='admin-console__container'
                    data-testid='global_attributes'
                >
                    <div className='GlobalAttributes__actions'>
                        <Button
                            emphasis='primary'
                            onClick={() => {
                                getHistory().push(ATTRIBUTE_DETAILS_ROUTE);
                            }}
                            data-testid='newAttributeButton'
                        >
                            <PlusIcon size={18}/>
                            <span>
                                <FormattedMessage {...messages.newAttribute}/>
                            </span>
                        </Button>
                    </div>
                    <GlobalAttributesTable/>
                </div>
            </div>
        </div>
    );
};

export default GlobalAttributes;
