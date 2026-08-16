// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, ChevronRightIcon, GlobeIcon} from '@mattermost/compass-icons/components';
import type {PropertyPermissionLevel} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import Toggle from 'components/toggle';

import {displayLocationLabel, setterLabelFor, summarizeChannelResource} from './summary';
import type {ChannelDisplayLocation, ChannelResourceConfig} from './types';
import {CHANNEL_DISPLAY_LOCATIONS, CHANNEL_VALUE_SETTERS} from './types';

import './channels_resource_row.scss';

// Constants, not generated per instance: the card offers Channels once, so only
// one row can exist per attribute.
const BODY_ID = 'channelsResourceRowBody';
const LOCATIONS_LABEL_ID = 'channelsResourceLocationsLabel';

type Props = {
    value: ChannelResourceConfig;
    onChange: (next: ChannelResourceConfig) => void;
    onRemove: () => void;
    disabled?: boolean;
};

/**
 * The Channels entry in an attribute's "Applies to" card.
 *
 * Never dispatches and never saves: the hosting page owns the form and its Save,
 * so this drops into a card owned by another team without either side owning
 * half a save.
 */
const ChannelsResourceRow = ({value, onChange, onRemove, disabled}: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const [expanded, setExpanded] = useState(true);

    const summary = useMemo(() => summarizeChannelResource(value, intl), [value, intl]);

    const handleRequiredToggle = useCallback(() => {
        onChange({...value, required: !value.required});
    }, [onChange, value]);

    const handleEditableToggle = useCallback(() => {
        onChange({...value, editable: !value.editable});
    }, [onChange, value]);

    const handleLocationChange = useCallback((location: ChannelDisplayLocation, checked: boolean) => {
        // Rebuilt in canonical order rather than appended, so two identically
        // configured attributes serialize the same way whatever the tick order.
        const next = CHANNEL_DISPLAY_LOCATIONS.filter((candidate) => {
            return candidate === location ? checked : value.displayLocations.includes(candidate);
        });
        onChange({...value, displayLocations: [...next]});
    }, [onChange, value]);

    const handleSetterChange = useCallback((permissionValues: PropertyPermissionLevel) => {
        onChange({...value, permissionValues});
    }, [onChange, value]);

    const setterLabel = setterLabelFor(value.permissionValues);

    return (
        <div
            className='ChannelsResourceRow'
            data-testid='channelsResourceRow'
        >
            <div className='ChannelsResourceRow__header'>
                <button
                    type='button'
                    className='ChannelsResourceRow__disclosure'
                    aria-expanded={expanded}
                    aria-controls={BODY_ID}
                    aria-label={formatMessage(expanded ? messages.collapse : messages.expand)}
                    onClick={() => setExpanded((current) => !current)}
                    data-testid='channelsResourceRowDisclosure'
                >
                    {expanded ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
                </button>
                <div className='ChannelsResourceRow__heading'>
                    <span className='ChannelsResourceRow__title'>
                        <GlobeIcon size={16}/>
                        <FormattedMessage {...messages.title}/>
                    </span>
                    <span
                        className='ChannelsResourceRow__summary'
                        data-testid='channelsResourceRowSummary'
                    >
                        {summary}
                    </span>
                </div>
                <button
                    type='button'
                    className='ChannelsResourceRow__remove'
                    onClick={onRemove}
                    disabled={disabled}
                    data-testid='channelsResourceRowRemove'
                >
                    <FormattedMessage {...messages.remove}/>
                </button>
            </div>

            {expanded && (
                <div
                    className='ChannelsResourceRow__body'
                    id={BODY_ID}
                >
                    <div className='ChannelsResourceRow__field'>
                        <span className='ChannelsResourceRow__label'>
                            <FormattedMessage {...messages.requiredLabel}/>
                        </span>
                        <div className='ChannelsResourceRow__control'>
                            <Toggle
                                id='channelsResourceRequired'
                                size='btn-md'
                                toggled={value.required}
                                disabled={disabled}
                                onToggle={handleRequiredToggle}
                                ariaLabel={formatMessage(messages.requiredLabel)}
                                onText={<FormattedMessage {...messages.on}/>}
                                offText={<FormattedMessage {...messages.off}/>}
                            />
                            <p className='ChannelsResourceRow__help'>
                                <FormattedMessage {...messages.requiredHelp}/>
                            </p>
                        </div>
                    </div>

                    <div className='ChannelsResourceRow__field'>
                        <span className='ChannelsResourceRow__label'>
                            <FormattedMessage {...messages.editableLabel}/>
                        </span>
                        <div className='ChannelsResourceRow__control'>
                            <Toggle
                                id='channelsResourceEditable'
                                size='btn-md'
                                toggled={value.editable}
                                disabled={disabled}
                                onToggle={handleEditableToggle}
                                ariaLabel={formatMessage(messages.editableLabel)}
                                onText={<FormattedMessage {...messages.on}/>}
                                offText={<FormattedMessage {...messages.off}/>}
                            />
                            <p className='ChannelsResourceRow__help'>
                                <FormattedMessage {...messages.editableHelp}/>
                            </p>
                        </div>
                    </div>

                    <div className='ChannelsResourceRow__field'>
                        <span
                            className='ChannelsResourceRow__label'
                            id={LOCATIONS_LABEL_ID}
                        >
                            <FormattedMessage {...messages.displayLabel}/>
                        </span>
                        <div className='ChannelsResourceRow__control'>
                            <div
                                className='ChannelsResourceRow__locations'
                                role='group'
                                aria-labelledby={LOCATIONS_LABEL_ID}
                            >
                                {CHANNEL_DISPLAY_LOCATIONS.map((location) => (
                                    <label
                                        key={location}
                                        className='ChannelsResourceRow__checkbox'
                                    >
                                        <input
                                            type='checkbox'
                                            checked={value.displayLocations.includes(location)}
                                            disabled={disabled}
                                            onChange={(e) => handleLocationChange(location, e.target.checked)}
                                            data-testid={`channelsResourceLocation-${location}`}
                                        />
                                        <span>{displayLocationLabel(location, intl)}</span>
                                    </label>
                                ))}
                            </div>
                            <p className='ChannelsResourceRow__help'>
                                <FormattedMessage {...messages.displayHelp}/>
                            </p>
                        </div>
                    </div>

                    <div className='ChannelsResourceRow__field'>
                        <span className='ChannelsResourceRow__label'>
                            <FormattedMessage {...messages.setterLabel}/>
                        </span>
                        <div className='ChannelsResourceRow__control'>
                            <Menu.Container
                                menuButton={{
                                    id: 'channelsResourceSetterButton',
                                    class: 'ChannelsResourceRow__setterButton',
                                    disabled,
                                    'aria-label': formatMessage(messages.setterAriaLabel, {value: formatMessage(setterLabel)}),
                                    children: (
                                        <>
                                            <FormattedMessage {...setterLabel}/>
                                            <i className='icon icon-chevron-down'/>
                                        </>
                                    ),
                                    dataTestId: 'channelsResourceSetterButton',
                                }}
                                menu={{
                                    id: 'channelsResourceSetterMenu',
                                    'aria-label': formatMessage(messages.setterLabel),
                                }}
                            >
                                {CHANNEL_VALUE_SETTERS.map((setter) => (
                                    <Menu.Item
                                        id={`channelsResourceSetter-${setter}`}
                                        key={setter}
                                        role='menuitemradio'
                                        aria-checked={setter === value.permissionValues}
                                        forceCloseOnSelect={true}
                                        onClick={() => handleSetterChange(setter)}
                                        labels={<FormattedMessage {...setterLabelFor(setter)}/>}
                                    />
                                ))}
                            </Menu.Container>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const messages = defineMessages({
    title: {id: 'admin.global_attributes.applies_to.channels.title', defaultMessage: 'Channels'},
    expand: {id: 'admin.global_attributes.applies_to.channels.expand', defaultMessage: 'Expand channel settings'},
    collapse: {id: 'admin.global_attributes.applies_to.channels.collapse', defaultMessage: 'Collapse channel settings'},
    on: {id: 'admin.global_attributes.applies_to.channels.toggle.on', defaultMessage: 'On'},
    off: {id: 'admin.global_attributes.applies_to.channels.toggle.off', defaultMessage: 'Off'},
    remove: {id: 'admin.global_attributes.applies_to.channels.remove', defaultMessage: 'Remove resource'},
    requiredLabel: {id: 'admin.global_attributes.applies_to.channels.required.label', defaultMessage: 'Required'},
    requiredHelp: {id: 'admin.global_attributes.applies_to.channels.required.help', defaultMessage: 'The channel must have a value for this attribute before it can be created.'},
    editableLabel: {id: 'admin.global_attributes.applies_to.channels.editable.label', defaultMessage: 'Allow changes'},
    editableHelp: {id: 'admin.global_attributes.applies_to.channels.editable.help', defaultMessage: 'When off, the value cannot be changed after it is first set.'},
    displayLabel: {id: 'admin.global_attributes.applies_to.channels.display.label', defaultMessage: 'Display location'},
    displayHelp: {id: 'admin.global_attributes.applies_to.channels.display.help', defaultMessage: 'Multiple locations can be selected. Uncheck all to hide.'},
    setterLabel: {id: 'admin.global_attributes.applies_to.channels.setter.label', defaultMessage: 'Who can set the value'},
    setterAriaLabel: {id: 'admin.global_attributes.applies_to.channels.setter.aria_label', defaultMessage: 'Who can set the value, currently {value}'},
});

export default ChannelsResourceRow;
