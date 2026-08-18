// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, MessageTextOutlineIcon} from '@mattermost/compass-icons/components';

import {resourceTypeLabels} from './attribute_applies_to_constants';
import type {AttributeAppliesToItemProps} from './attribute_applies_to_constants';

import './attribute_applies_to_item.scss';

const BODY_ID = 'attribute-applies-to-post-panel';

// The Posts row of the Applies-to list -- owns its own expand/collapse state
// (deliberately not the shared Accordion component, see the plan's Decisions
// table: AccordionCard renders the row itself from plain data with no slot
// for a child component to own it, and its open-row tracking is by array
// index, which misattributes state when a row is removed from the middle of
// the list). Remove is only reachable once expanded -- there is no
// collapsed-row remove affordance.
function AttributeAppliesToPostItem({disabled = false, onRemove}: AttributeAppliesToItemProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);

    const label = formatMessage(resourceTypeLabels.post);
    const toggleLabel = formatMessage(isOpen ? messages.collapseLabel : messages.expandLabel, {label});

    return (
        <div
            className='AttributeAppliesToItem'
            data-testid='attributeAppliesToRow-post'
        >
            <div className='AttributeAppliesToItem__header'>
                <button
                    type='button'
                    className='AttributeAppliesToItem__toggle'
                    onClick={() => setIsOpen((prev) => !prev)}
                    disabled={disabled}
                    aria-expanded={isOpen}
                    aria-controls={BODY_ID}
                    aria-label={toggleLabel}
                    data-testid='attributeAppliesToRow-post-toggle'
                >
                    <ChevronDownIcon
                        size={16}
                        className={classNames('AttributeAppliesToItem__chevron', {'AttributeAppliesToItem__chevron--open': isOpen})}
                    />
                    <MessageTextOutlineIcon size={18}/>
                    <span className='AttributeAppliesToItem__label'>{label}</span>
                </button>
                {isOpen && (
                    <button
                        type='button'
                        className='AttributeAppliesToItem__remove'
                        onClick={onRemove}
                        disabled={disabled}
                        data-testid='attributeAppliesToRow-post-remove'
                    >
                        <FormattedMessage {...messages.removeLabel}/>
                    </button>
                )}
            </div>
            {isOpen && (
                <div
                    id={BODY_ID}
                    role='region'
                    aria-label={label}
                    className='AttributeAppliesToItem__body'
                    data-testid='attributeAppliesToRow-post-body'
                >
                    <FormattedMessage {...messages.bodyPlaceholder}/>
                </div>
            )}
        </div>
    );
}

export default AttributeAppliesToPostItem;

const messages = defineMessages({
    expandLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.expand', defaultMessage: 'Expand {label}'},
    collapseLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.collapse', defaultMessage: 'Collapse {label}'},
    removeLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.remove', defaultMessage: 'Remove resource'},
    bodyPlaceholder: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.body_placeholder',
        defaultMessage: 'No additional settings for this resource yet.',
    },
});
