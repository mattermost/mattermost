// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import {resourceTypeLabels} from './attribute_applies_to_constants';
import type {AttributeAppliesToItemProps} from './attribute_applies_to_constants';

import './attribute_applies_to_item.scss';

const BODY_ID = 'attribute-applies-to-channel-panel';

// The Channels row of the Applies-to list -- owns its own expand/collapse
// state (deliberately not the shared Accordion component, see the plan's
// Decisions table: AccordionCard renders the row itself from plain data with
// no slot for a child component to own it, and its open-row tracking is by
// array index, which misattributes state when a row is removed from the
// middle of the list). Remove is only reachable once expanded -- there is no
// collapsed-row remove affordance.
function AttributeAppliesToChannelItem({disabled = false, onRemove}: AttributeAppliesToItemProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);

    const label = formatMessage(resourceTypeLabels.channel);
    const toggleLabel = formatMessage(isOpen ? messages.collapseLabel : messages.expandLabel, {label});

    return (
        <div
            className={classNames('AttributeAppliesToItem', {'AttributeAppliesToItem--open': isOpen})}
            data-testid='attributeAppliesToRow-channel'
        >
            <div className='AttributeAppliesToItem__header'>
                <Button
                    type='button'
                    emphasis='quaternary'
                    className='AttributeAppliesToItem__toggle'
                    onClick={() => setIsOpen((prev) => !prev)}
                    disabled={disabled}
                    aria-expanded={isOpen}
                    aria-controls={BODY_ID}
                    aria-label={toggleLabel}
                    data-testid='attributeAppliesToRow-channel-toggle'
                >
                    <ChevronDownIcon
                        size={16}
                        className={classNames('AttributeAppliesToItem__chevron', {'AttributeAppliesToItem__chevron--open': isOpen})}
                    />
                    <ProductChannelsIcon size={18}/>
                    <span className='AttributeAppliesToItem__label'>{label}</span>
                </Button>
                {isOpen && (
                    <Button
                        type='button'
                        emphasis='tertiary'
                        variant='destructive'
                        size='sm'
                        className='AttributeAppliesToItem__remove'
                        onClick={onRemove}
                        disabled={disabled}
                        data-testid='attributeAppliesToRow-channel-remove'
                    >
                        <FormattedMessage {...messages.removeLabel}/>
                    </Button>
                )}
            </div>
            {isOpen && (
                <div
                    id={BODY_ID}
                    role='region'
                    aria-label={label}
                    className='AttributeAppliesToItem__body'
                    data-testid='attributeAppliesToRow-channel-body'
                >
                    <div className='AttributeAppliesToItem__row'>
                        <span>
                            <FormattedMessage {...messages.bodyPlaceholder}/>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AttributeAppliesToChannelItem;

const messages = defineMessages({
    expandLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.expand', defaultMessage: 'Expand {label}'},
    collapseLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.collapse', defaultMessage: 'Collapse {label}'},
    removeLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.remove', defaultMessage: 'Remove resource'},
    bodyPlaceholder: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.body_placeholder',
        defaultMessage: 'No additional settings for this resource yet.',
    },
});
