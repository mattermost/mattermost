// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {buttonClassNames} from '@mattermost/shared/components/button';

import Card from 'components/card/card';
import * as Menu from 'components/menu';

import {ALL_RESOURCE_TYPES, ATTRIBUTE_APPLIES_TO_ADD_HEADER_TRIGGER_ID, RESOURCE_TYPE_ICONS, resourceTypeLabels} from './attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_applies_to_constants';
import AttributeAppliesToItem from './attribute_applies_to_item';

import './attribute_applies_to.scss';

type Props = {
    appliesTo: ResourceObjectType[];
    disabled?: boolean;
    onAdd: (type: ResourceObjectType) => void;
    onRemove: (type: ResourceObjectType) => void;
};

// Owns only the Card chrome (header, "Add resource" triggers, empty state)
// and renders one AttributeAppliesToItem per entry in appliesTo. Holds no
// selection state of its own -- "available" picker options are derived
// purely from props on every render. Makes no data-mutating dispatch calls,
// no Client4/API calls (see R6 -- the page owns all of that).
function AttributeAppliesTo({appliesTo, disabled = false, onAdd, onRemove}: Props): JSX.Element {
    const {formatMessage} = useIntl();

    const availableTypes = useMemo(
        () => ALL_RESOURCE_TYPES.filter((type) => !appliesTo.includes(type)),
        [appliesTo],
    );

    const renderAddResourceMenu = (triggerId: string, dataTestId: string, label: string) => (
        <Menu.Container
            menuButton={{
                id: triggerId,
                class: classNames(buttonClassNames({emphasis: 'quaternary'}), 'AttributeAppliesTo__trigger'),
                disabled,
                'aria-label': label,
                children: (
                    <>
                        <PlusIcon size={16}/>
                        {label}
                    </>
                ),
                dataTestId,
            }}
            menu={{
                id: `${triggerId}-menu`,
                'aria-label': label,
            }}
        >
            {availableTypes.map((type) => {
                const ItemIcon = RESOURCE_TYPE_ICONS[type];
                return (
                    <Menu.Item
                        id={`${triggerId}-${type}`}
                        key={type}
                        leadingElement={<ItemIcon size={18}/>}
                        onClick={() => onAdd(type)}
                        labels={<FormattedMessage {...resourceTypeLabels[type]}/>}
                    />
                );
            })}
        </Menu.Container>
    );

    return (
        <div data-testid='attributeAppliesTo'>
            <Card
                expanded={true}
                disableExpandAnimation={true}
                className='console AttributeAppliesTo'
            >
                <Card.Header>
                    <div className='AttributeDetails__headerGroup'>
                        <div className='AttributeDetails__blockTitle'>
                            <FormattedMessage {...messages.title}/>
                        </div>
                        <FormattedMessage
                            tagName='p'
                            {...messages.subtitle}
                        />
                    </div>
                    {availableTypes.length > 0 && renderAddResourceMenu(
                        ATTRIBUTE_APPLIES_TO_ADD_HEADER_TRIGGER_ID,
                        'attributeAppliesToAddResourceButtonHeader',
                        formatMessage(messages.addResourceHeader),
                    )}
                </Card.Header>
                <Card.Body expanded={true}>
                    {appliesTo.length === 0 ? (
                        <div
                            className='AttributeAppliesTo__emptyState'
                            data-testid='attributeAppliesToEmptyState'
                        >
                            <FormattedMessage
                                tagName='h5'
                                {...messages.emptyStateHeading}
                            />
                            <p className='AttributeAppliesTo__emptyStateHelperText'>
                                <FormattedMessage {...messages.emptyStateHelperText}/>
                            </p>
                            {availableTypes.length > 0 && renderAddResourceMenu(
                                'attribute-applies-to-add-inline',
                                'attributeAppliesToAddResourceButtonInline',
                                formatMessage(messages.addResourceInline),
                            )}
                        </div>
                    ) : (
                        <>
                            <div className='AttributeAppliesTo__list'>
                                {appliesTo.map((type) => (
                                    <AttributeAppliesToItem
                                        key={type}
                                        resourceType={type}
                                        disabled={disabled}
                                        onRemove={() => onRemove(type)}
                                    />
                                ))}
                            </div>
                            {availableTypes.length > 0 && renderAddResourceMenu(
                                'attribute-applies-to-add-inline',
                                'attributeAppliesToAddResourceButtonInline',
                                formatMessage(messages.addResourceInline),
                            )}
                        </>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
}

export default AttributeAppliesTo;

const messages = defineMessages({
    title: {id: 'admin.global_attributes.attribute_details.applies_to.title', defaultMessage: 'Applies to'},
    subtitle: {id: 'admin.global_attributes.attribute_details.applies_to.subtitle', defaultMessage: 'Choose which kinds of resources this attribute applies to.'},
    emptyStateHeading: {id: 'admin.global_attributes.attribute_details.applies_to.empty_state.heading', defaultMessage: 'Nothing added yet'},
    emptyStateHelperText: {
        id: 'admin.global_attributes.attribute_details.applies_to.empty_state.helper_text',
        defaultMessage: 'Add a resource to choose where this attribute applies.',
    },
    addResourceHeader: {id: 'admin.global_attributes.attribute_details.applies_to.add_resource_header', defaultMessage: 'Add resource'},
    addResourceInline: {id: 'admin.global_attributes.attribute_details.applies_to.add_resource_inline', defaultMessage: 'Add another resource'},
});
