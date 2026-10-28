// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {MagnifyIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {GlobalAttributeResourceType, GlobalAttributeSource} from '@mattermost/types/global_attributes';

import AdminHeader from 'components/widgets/admin_console/admin_header';
import Input from 'components/widgets/inputs/input/input';

import {getHistory} from 'utils/browser_history';

import {ATTRIBUTE_DETAILS_ROUTE} from './constants';
import GlobalAttributesTable from './global_attributes_table';
import ResourceTypeFilter from './resource_type_filter';
import SourceFilter from './source_filter';
import useAllowedResourceTypes from './use_allowed_resource_types';

import './global_attributes.scss';

const messages = defineMessages({
    title: {id: 'admin.global_attributes.title', defaultMessage: 'Attribute Management'},
    subtitle: {id: 'admin.global_attributes.subtitle', defaultMessage: 'Define an attribute once, then choose which resources can use it.'},
    newAttribute: {id: 'admin.global_attributes.new_attribute', defaultMessage: 'New attribute'},
    searchPlaceholder: {id: 'admin.global_attributes.search.placeholder', defaultMessage: 'Search attributes'},
});

export const searchableStrings = [
    messages.title,
    messages.searchPlaceholder,
];

type Props = {
    disabled?: boolean;
};

const GlobalAttributes = ({disabled = false}: Props) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [source, setSource] = useState<GlobalAttributeSource>();
    const [selectedResourceType, setResourceType] = useState<GlobalAttributeResourceType>();

    // With a single resource type on offer, filtering by it would only hide the
    // templates applied to nothing, so the filter is not shown. A type the
    // server stops offering is dropped rather than kept as a hidden filter.
    const allowedResourceTypes = useAllowedResourceTypes();
    const showResourceTypeFilter = allowedResourceTypes.length > 1;
    const resourceType = showResourceTypeFilter && selectedResourceType && allowedResourceTypes.includes(selectedResourceType) ? selectedResourceType : undefined;

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setSearchQuery(event.target.value);
    }, []);

    const handleSearchClear = useCallback(() => {
        setSearchQuery('');
    }, []);

    const handleClearFilters = useCallback(() => {
        setSearchQuery('');
        setSource(undefined);
        setResourceType(undefined);
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
                <Button
                    className='GlobalAttributes__newAttribute'
                    emphasis='primary'
                    disabled={disabled}
                    onClick={() => {
                        getHistory().push(ATTRIBUTE_DETAILS_ROUTE);
                    }}
                    data-testid='newAttributeButton'
                    leadingIcon={<Icon glyph={<PlusIcon/>}/>}
                >
                    <FormattedMessage {...messages.newAttribute}/>
                </Button>
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
                        <SourceFilter
                            value={source}
                            onChange={setSource}
                        />
                        {showResourceTypeFilter && (
                            <ResourceTypeFilter
                                allowedTypes={allowedResourceTypes}
                                value={resourceType}
                                onChange={setResourceType}
                            />
                        )}
                    </div>
                    <GlobalAttributesTable
                        searchQuery={searchQuery}
                        source={source}
                        resourceType={resourceType}
                        onClearFilters={handleClearFilters}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};

export default GlobalAttributes;
