// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, CloseIcon} from '@mattermost/compass-icons/components';

import {RESOURCE_TYPE_ICONS, resourceTypeLabels} from './attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_applies_to_constants';

import './attribute_applies_to_item.scss';

type Props = {
    resourceType: ResourceObjectType;
    disabled?: boolean;
    onRemove: () => void;
};

// One row per selected resource type -- owns its own expand/collapse state
// (deliberately not the shared Accordion component, see the plan's Decisions
// table: AccordionCard renders the row itself from plain data with no slot
// for a child component to own it, and its open-row tracking is by array
// index, which misattributes state when a row is removed from the middle of
// the list).
function AttributeAppliesToItem({resourceType, disabled = false, onRemove}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);

    const Icon = RESOURCE_TYPE_ICONS[resourceType];
    const label = formatMessage(resourceTypeLabels[resourceType]);
    const removeLabel = formatMessage(messages.removeLabel, {label});
    const toggleLabel = formatMessage(isOpen ? messages.collapseLabel : messages.expandLabel, {label});
    const bodyId = `attribute-applies-to-${resourceType}-panel`;

    return (
        <div
            className='AttributeAppliesToItem'
            data-testid={`attributeAppliesToRow-${resourceType}`}
        >
            <div className='AttributeAppliesToItem__header'>
                <button
                    type='button'
                    className='AttributeAppliesToItem__toggle'
                    onClick={() => setIsOpen((prev) => !prev)}
                    disabled={disabled}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    aria-label={toggleLabel}
                    data-testid={`attributeAppliesToRow-${resourceType}-toggle`}
                >
                    <ChevronDownIcon
                        size={16}
                        className={classNames('AttributeAppliesToItem__chevron', {'AttributeAppliesToItem__chevron--open': isOpen})}
                    />
                    <Icon size={18}/>
                    <span className='AttributeAppliesToItem__label'>{label}</span>
                </button>
                <button
                    type='button'
                    className='AttributeAppliesToItem__remove'
                    onClick={onRemove}
                    disabled={disabled}
                    aria-label={removeLabel}
                    data-testid={`attributeAppliesToRow-${resourceType}-remove`}
                >
                    <CloseIcon size={16}/>
                </button>
            </div>
            {isOpen && (
                <div
                    id={bodyId}
                    role='region'
                    aria-label={label}
                    className='AttributeAppliesToItem__body'
                    data-testid={`attributeAppliesToRow-${resourceType}-body`}
                >
                    <FormattedMessage {...messages.bodyPlaceholder}/>
                </div>
            )}
        </div>
    );
}

export default AttributeAppliesToItem;

const messages = defineMessages({
    expandLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.expand', defaultMessage: 'Expand {label}'},
    collapseLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.collapse', defaultMessage: 'Collapse {label}'},
    removeLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.remove', defaultMessage: 'Remove {label}'},
    bodyPlaceholder: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.body_placeholder',
        defaultMessage: 'No additional settings for this resource yet.',
    },
});
