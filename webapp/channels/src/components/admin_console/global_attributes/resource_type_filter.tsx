// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {defineMessages} from 'react-intl';

import type {GlobalAttributeResourceType} from '@mattermost/types/global_attributes';

import {resourceTypeLabels} from './attribute_details/attribute_applies_to_constants';
import FilterMenu from './filter_menu';
import type {FilterMenuOption} from './filter_menu';

const messages = defineMessages({
    label: {id: 'admin.global_attributes.filter.resource_type', defaultMessage: 'Resource type'},
    menuButtonAriaLabel: {id: 'admin.global_attributes.filter.resource_type.menuButtonAriaLabel', defaultMessage: 'Filter attributes by resource type'},
    menuAriaLabel: {id: 'admin.global_attributes.filter.resource_type.menuAriaLabel', defaultMessage: 'Resource type menu'},
    all: {id: 'admin.global_attributes.filter.resource_type.all', defaultMessage: 'All'},
});

type Props = {

    // The resource types this server offers; only these are options.
    allowedTypes: GlobalAttributeResourceType[];
    value: GlobalAttributeResourceType | undefined;
    onChange: (value: GlobalAttributeResourceType | undefined) => void;
};

export default function ResourceTypeFilter({allowedTypes, value, onChange}: Props) {
    const options = useMemo<Array<FilterMenuOption<GlobalAttributeResourceType>>>(() => [
        {value: undefined, label: messages.all},
        ...allowedTypes.map((type) => ({value: type, label: resourceTypeLabels[type]})),
    ], [allowedTypes]);

    return (
        <FilterMenu
            id='globalAttributesResourceTypeFilter'
            testId='global-attributes-resource-type-filter'
            label={messages.label}
            menuButtonAriaLabel={messages.menuButtonAriaLabel}
            menuAriaLabel={messages.menuAriaLabel}
            options={options}
            value={value}
            onChange={onChange}
        />
    );
}
