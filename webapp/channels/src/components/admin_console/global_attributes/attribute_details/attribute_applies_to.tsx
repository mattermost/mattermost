// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import type {ButtonEmphasis} from '@mattermost/shared/components/button';
import {buttonClassNames} from '@mattermost/shared/components/button';

import Card from 'components/card/card';
import * as Menu from 'components/menu';

import AttributeAppliesToChannelItem from './attribute_applies_to_channel_item';
import {ALL_RESOURCE_TYPES, ATTRIBUTE_APPLIES_TO_ADD_HEADER_TRIGGER_ID, RESOURCE_TYPE_ICONS, resourceTypeLabels} from './attribute_applies_to_constants';
import type {AttributeAppliesToItemProps, ResourceObjectType} from './attribute_applies_to_constants';
import AttributeAppliesToPostItem from './attribute_applies_to_post_item';
import AttributeAppliesToUserItem from './attribute_applies_to_user_item';

import type {ChannelResourceConfig} from '../applies_to/channels/types';

import './attribute_applies_to.scss';

type Props = {
    appliesTo: ResourceObjectType[];
    disabled?: boolean;
    onAdd: (type: ResourceObjectType) => void;
    onRemove: (type: ResourceObjectType) => void;

    // Channels only: the settings its row edits, held by the page because the
    // linked channel field is built from them on Save.
    channelResource: ChannelResourceConfig;
    onChannelResourceChange: (next: ChannelResourceConfig) => void;

    // Whether the attribute is rank-typed, which gates the directional change
    // policies on the Channels row.
    ordered?: boolean;

    // Resources this server may offer. Channels is dropped below Enterprise
    // Advanced, or with the ChannelAttributes flag off.
    allowedTypes?: ResourceObjectType[];
};

// Every entry here must implement AttributeAppliesToItemProps exactly --
// TypeScript rejects the map itself if either row component's props drift
// from that shared signature, rather than only failing wherever they happen
// to get used. Channels is absent: it is the one row with settings of its
// own, so it takes props the other two have no use for.
const RESOURCE_TYPE_ITEM_COMPONENTS: Record<Exclude<ResourceObjectType, 'channel'>, ComponentType<AttributeAppliesToItemProps>> = {
    user: AttributeAppliesToUserItem,
    post: AttributeAppliesToPostItem,
};

// Owns only the Card chrome (header, "Add resource" triggers, empty state)
// and renders one per-type row component per entry in appliesTo (a dedicated
// component per resource type -- AttributeAppliesToUserItem/ChannelItem/
// PostItem -- rather than one generic item parameterized by resourceType).
// Holds no selection state of its own -- "available" picker options are
// derived purely from props on every render. Makes no data-mutating dispatch
// calls, no Client4/API calls (see R6 -- the page owns all of that).
function AttributeAppliesTo({appliesTo, disabled = false, onAdd, onRemove, channelResource, onChannelResourceChange, ordered, allowedTypes = ALL_RESOURCE_TYPES}: Props): JSX.Element {
    const {formatMessage} = useIntl();

    const availableTypes = useMemo(
        () => ALL_RESOURCE_TYPES.filter((type) => allowedTypes.includes(type) && !appliesTo.includes(type)),
        [appliesTo, allowedTypes],
    );

    const renderAddResourceMenu = (triggerId: string, dataTestId: string, label: string, emphasis: ButtonEmphasis) => (
        <Menu.Container
            menuButton={{
                id: triggerId,
                class: classNames(buttonClassNames({emphasis}), 'AttributeAppliesTo__trigger'),
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
                        'tertiary',
                    )}
                </Card.Header>
                <Card.Body expanded={true}>
                    {appliesTo.length === 0 ? (
                        <div
                            className='AttributeAppliesTo__emptyState'
                            data-testid='attributeAppliesToEmptyState'
                        >
                            <h5 className='AttributeAppliesTo__emptyStateHeading'>
                                <FormattedMessage {...messages.emptyStateHeading}/>
                            </h5>
                            <p className='AttributeAppliesTo__emptyStateHelperText'>
                                <FormattedMessage {...messages.emptyStateHelperText}/>
                            </p>
                            {availableTypes.length > 0 && renderAddResourceMenu(
                                'attribute-applies-to-add-inline',
                                'attributeAppliesToAddResourceButtonInline',
                                formatMessage(messages.addResourceHeader),
                                'primary',
                            )}
                        </div>
                    ) : (
                        <>
                            <div className='AttributeAppliesTo__list'>
                                {appliesTo.map((type) => {
                                    if (type === 'channel') {
                                        return (
                                            <AttributeAppliesToChannelItem
                                                key={type}
                                                config={channelResource}
                                                onConfigChange={onChannelResourceChange}
                                                ordered={ordered}
                                                disabled={disabled}
                                                onRemove={() => onRemove(type)}
                                            />
                                        );
                                    }

                                    const Item = RESOURCE_TYPE_ITEM_COMPONENTS[type];
                                    return (
                                        <Item
                                            key={type}
                                            disabled={disabled}
                                            onRemove={() => onRemove(type)}
                                        />
                                    );
                                })}
                            </div>
                            {availableTypes.length > 0 && renderAddResourceMenu(
                                'attribute-applies-to-add-inline',
                                'attributeAppliesToAddResourceButtonInline',
                                formatMessage(messages.addResourceInline),
                                'tertiary',
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
    subtitle: {id: 'admin.global_attributes.attribute_details.applies_to.subtitle', defaultMessage: 'Resources this attribute applies to, and who can set the value on each.'},
    emptyStateHeading: {id: 'admin.global_attributes.attribute_details.applies_to.empty_state.heading', defaultMessage: 'No resources yet'},
    emptyStateHelperText: {
        id: 'admin.global_attributes.attribute_details.applies_to.empty_state.helper_text',
        defaultMessage: 'Add a resource to apply this attribute to users, channels, or posts.',
    },
    addResourceHeader: {id: 'admin.global_attributes.attribute_details.applies_to.add_resource_header', defaultMessage: 'Add resource'},
    addResourceInline: {id: 'admin.global_attributes.attribute_details.applies_to.add_resource_inline', defaultMessage: 'Add another resource'},
});
