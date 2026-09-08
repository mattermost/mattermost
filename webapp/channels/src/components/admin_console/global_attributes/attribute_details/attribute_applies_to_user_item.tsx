// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, type JSX} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {AccountOutlineIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {FieldVisibility} from '@mattermost/types/properties';

import RadioButtonGroup from 'components/common/radio_group';

import {resourceTypeLabels} from './attribute_applies_to_constants';
import type {AttributeAppliesToItemProps, UserManagedValue} from './attribute_applies_to_constants';

import './attribute_applies_to_item.scss';

const BODY_ID = 'attribute-applies-to-user-panel';

// Order matches the screenshot's pill row: Always | When set | Hidden.
const PROFILE_DISPLAY_VALUES: FieldVisibility[] = ['always', 'when_set', 'hidden'];

// The Users row of the Applies-to list -- owns its own expand/collapse state
// (deliberately not the shared Accordion component, see the plan's Decisions
// table: AccordionCard renders the row itself from plain data with no slot
// for a child component to own it, and its open-row tracking is by array
// index, which misattributes state when a row is removed from the middle of
// the list). Remove is only reachable once expanded -- there is no
// collapsed-row remove affordance.
function AttributeAppliesToUserItem({
    disabled = false,
    lockedTooltip,
    onRemove,
    visibility = 'when_set',
    onVisibilityChange,
    managed = '',
    onManagedChange,
}: AttributeAppliesToItemProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);

    const handleManagedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onManagedChange?.(e.target.value as UserManagedValue);
    };

    const label = formatMessage(resourceTypeLabels.user);
    const toggleLabel = formatMessage(isOpen ? messages.collapseLabel : messages.expandLabel, {label});

    const toggleButton = (
        <Button
            type='button'
            emphasis='quaternary'
            className='AttributeAppliesToItem__toggle'
            onClick={() => setIsOpen((prev) => !prev)}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-controls={BODY_ID}
            aria-label={toggleLabel}
            data-testid='attributeAppliesToRow-user-toggle'
        >
            <ChevronDownIcon
                size={16}
                className={classNames('AttributeAppliesToItem__chevron', {'AttributeAppliesToItem__chevron--open': isOpen})}
            />
            <AccountOutlineIcon size={18}/>
            <span className='AttributeAppliesToItem__label'>{label}</span>
        </Button>
    );

    return (
        <div
            className={classNames('AttributeAppliesToItem', {'AttributeAppliesToItem--open': isOpen})}
            data-testid='attributeAppliesToRow-user'
        >
            <div className='AttributeAppliesToItem__header'>
                {lockedTooltip ? (
                    <WithTooltip title={lockedTooltip}>
                        <span
                            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WithTooltip's useFocus only fires on its cloned child; without this the disabled toggle is unreachable by keyboard, so the tooltip explaining the lock is mouse-only
                            tabIndex={0}
                            data-testid='attributeAppliesToRow-user-toggleLockWrap'
                        >
                            {toggleButton}
                        </span>
                    </WithTooltip>
                ) : toggleButton}
                {isOpen && (
                    <Button
                        type='button'
                        emphasis='tertiary'
                        variant='destructive'
                        size='sm'
                        className='AttributeAppliesToItem__remove'
                        onClick={onRemove}
                        disabled={disabled}
                        data-testid='attributeAppliesToRow-user-remove'
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
                    data-testid='attributeAppliesToRow-user-body'
                >
                    <div className='AttributeAppliesToItem__row'>
                        <span className='AttributeAppliesToItem__label'>
                            <FormattedMessage {...messages.profileDisplayLabel}/>
                        </span>
                        <div
                            className='AttributeAppliesToItem__profileDisplaySegments'
                            role='group'
                            aria-label={formatMessage(messages.profileDisplayLabel)}
                        >
                            {PROFILE_DISPLAY_VALUES.map((value) => (
                                <button
                                    key={value}
                                    type='button'
                                    className={classNames('AttributeAppliesToItem__profileDisplaySegment', {
                                        'AttributeAppliesToItem__profileDisplaySegment--active': visibility === value,
                                    })}
                                    aria-pressed={visibility === value}
                                    disabled={disabled}
                                    data-testid={`attributeAppliesToUserProfileDisplay-${value}`}
                                    onClick={() => onVisibilityChange?.(value)}
                                >
                                    <FormattedMessage {...profileDisplayValueMessages[value]}/>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className='AttributeAppliesToItem__row'>
                        <span className='AttributeAppliesToItem__label'>
                            <FormattedMessage {...messages.whoCanSetLabel}/>
                        </span>
                        <RadioButtonGroup
                            id='attribute-applies-to-user-who-can-set'
                            testId='attributeAppliesToUserWhoCanSet'
                            value={managed}
                            onChange={handleManagedChange}
                            isDisabled={disabled ? () => true : null}
                            sideLegend={{matchVal: 'admin', text: formatMessage(messages.whoCanSetAdminHelp)}}
                            values={[
                                {
                                    key: <FormattedMessage {...messages.whoCanSetMemberLabel}/>,
                                    value: '',
                                    testId: 'attributeAppliesToUserWhoCanSet-member',
                                },
                                {
                                    key: <FormattedMessage {...messages.whoCanSetAdminLabel}/>,
                                    value: 'admin',
                                    testId: 'attributeAppliesToUserWhoCanSet-admin',
                                },
                            ]}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default AttributeAppliesToUserItem;

const messages = defineMessages({
    expandLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.expand', defaultMessage: 'Expand {label}'},
    collapseLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.collapse', defaultMessage: 'Collapse {label}'},
    removeLabel: {id: 'admin.global_attributes.attribute_details.applies_to.item.remove', defaultMessage: 'Remove resource'},
    profileDisplayLabel: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.profile_display.label',
        defaultMessage: 'Profile display',
    },
    whoCanSetLabel: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.who_can_set.label',
        defaultMessage: 'Who can set the value',
    },
    whoCanSetMemberLabel: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.who_can_set.member.label',
        defaultMessage: 'Member',
    },
    whoCanSetAdminLabel: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.who_can_set.admin.label',
        defaultMessage: 'System Administrator',
    },
    whoCanSetAdminHelp: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.who_can_set.admin.help',
        defaultMessage: 'Only System Administrators can set this value. Members will see it as read-only on their profile.',
    },
});

const profileDisplayValueMessages: Record<FieldVisibility, MessageDescriptor> = defineMessages({
    always: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.profile_display.always.label',
        defaultMessage: 'Always',
    },
    when_set: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.profile_display.when_set.label',
        defaultMessage: 'When set',
    },
    hidden: {
        id: 'admin.global_attributes.attribute_details.applies_to.item.user.profile_display.hidden.label',
        defaultMessage: 'Hidden',
    },
});
