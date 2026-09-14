// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {MagnifyIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import AdminHeader from 'components/widgets/admin_console/admin_header';
import Input from 'components/widgets/inputs/input/input';

import {getHistory} from 'utils/browser_history';

import {ATTRIBUTE_DETAILS_ROUTE} from './constants';
import GlobalAttributesTable from './global_attributes_table';

import './global_attributes.scss';

const messages = defineMessages({
    title: {id: 'admin.global_attributes.title', defaultMessage: 'Manage Attributes'},
    subtitle: {id: 'admin.global_attributes.subtitle', defaultMessage: 'Define an attribute once, then choose which resources can use it.'},
    newAttribute: {id: 'admin.global_attributes.new_attribute', defaultMessage: 'New attribute'},
    searchPlaceholder: {id: 'admin.global_attributes.search.placeholder', defaultMessage: 'Search attributes'},
});

export const searchableStrings = [
    messages.title,
    messages.searchPlaceholder,
];

const GlobalAttributes: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSearchQuery(event.target.value);
    }, []);

    const handleSearchClear = useCallback(() => {
        setSearchQuery('');
    }, []);

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
                        <Input
                            type='text'
                            name='searchAttributes'
                            clearable={true}
                            useLegend={false}
                            containerClassName='GlobalAttributes__search'
                            placeholder={messages.searchPlaceholder}
                            inputPrefix={<MagnifyIcon size={16}/>}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onClear={handleSearchClear}
                            data-testid='global-attributes-search'
                        />
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
                    <GlobalAttributesTable searchQuery={searchQuery}/>
                </div>
            </div>
        </div>
    );
};

export default GlobalAttributes;
