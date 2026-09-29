// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {CheckIcon} from '@mattermost/compass-icons/components';

import {isChannelAttributesRequiredEnabled} from 'mattermost-redux/selectors/entities/general';

import * as Menu from 'components/menu';

import {changePolicyLabelFor, displayLocationLabel} from './summary';
import type {ChannelChangePolicy, ChannelDisplayLocation, ChannelResourceConfig} from './types';
import {CHANNEL_CHANGE_POLICIES, CHANNEL_DISPLAY_LOCATIONS, isOrderedChangePolicy} from './types';

import './channels_resource_settings.scss';

// A constant, not generated per instance: an attribute applies to Channels at
// most once, so only one of these can exist on a page.
const LOCATIONS_LABEL_ID = 'channelsResourceLocationsLabel';

type Props = {
    value: ChannelResourceConfig;
    onChange: (next: ChannelResourceConfig) => void;

    // Whether the attribute's values have a defined order, i.e. it is rank-typed.
    // Raise-only and lower-only are meaningless without one, so they are not offered.
    ordered?: boolean;

    disabled?: boolean;
};

/**
 * The settings an attribute carries on channels: whether a value is required,
 * where it displays, and how it may change once set.
 *
 * Never dispatches and never saves. Two hosts render it — the Applies-to card's
 * Channels row and the Classification page — and each owns its own Save.
 */
const ChannelsResourceSettings = ({value, onChange, ordered, disabled}: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;

    // ChannelAttributesRequired gates this toggle entirely rather than disabling
    // it: while enforcement is off there is no way to act on setting it, and
    // leaving it interactive would let an admin configure a state that quietly
    // does nothing until the flag is enabled.
    const requiredEnforcementEnabled = useSelector(isChannelAttributesRequiredEnabled);

    const handleRequiredToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        onChange({...value, required: event.target.checked});
    }, [onChange, value]);

    const handleChangePolicySelect = useCallback((changePolicy: ChannelChangePolicy) => {
        onChange({...value, changePolicy});
    }, [onChange, value]);

    const handleLocationChange = useCallback((location: ChannelDisplayLocation, checked: boolean) => {
        // Rebuilt in canonical order rather than appended, so two identically
        // configured attributes serialize the same way whatever the tick order.
        const next = CHANNEL_DISPLAY_LOCATIONS.filter((candidate) => {
            return candidate === location ? checked : value.displayLocations.includes(candidate);
        });
        onChange({...value, displayLocations: [...next]});
    }, [onChange, value]);

    const changePolicyLabel = changePolicyLabelFor(value.changePolicy);

    // A policy already set to raise/lower stays listed even on an unordered
    // attribute, so the menu can describe what is currently selected.
    const changePolicies = CHANNEL_CHANGE_POLICIES.filter((policy) => (
        ordered || !isOrderedChangePolicy(policy) || policy === value.changePolicy
    ));

    return (
        <div
            className='ChannelsResourceSettings'
            data-testid='channelsResourceSettings'
        >
            {requiredEnforcementEnabled && (
                <div className='ChannelsResourceSettings__field'>
                    <span className='ChannelsResourceSettings__label'>
                        <FormattedMessage {...messages.requiredLabel}/>
                    </span>
                    <div className='ChannelsResourceSettings__control'>
                        <label
                            className='ChannelsResourceSettings__switch'
                            htmlFor='channelsResourceRequired'
                        >
                            <span className='ChannelsResourceSettings__switchLabel'>
                                <FormattedMessage {...(value.required ? messages.on : messages.off)}/>
                            </span>
                            <span className='ChannelsResourceSettings__switchTrack'>
                                <input
                                    id='channelsResourceRequired'
                                    type='checkbox'
                                    role='switch'
                                    className='ChannelsResourceSettings__switchInput'
                                    checked={value.required}
                                    disabled={disabled}
                                    onChange={handleRequiredToggle}
                                    aria-label={formatMessage(messages.requiredLabel)}
                                    data-testid='channelsResourceRequired-button'
                                />
                                <span
                                    className='ChannelsResourceSettings__switchKnob'
                                    aria-hidden={true}
                                />
                            </span>
                        </label>
                        <p className='ChannelsResourceSettings__help'>
                            <FormattedMessage {...(value.required ? messages.requiredOnHelp : messages.requiredOffHelp)}/>
                        </p>
                    </div>
                </div>
            )}

            <div className='ChannelsResourceSettings__field'>
                <span
                    className='ChannelsResourceSettings__label'
                    id={LOCATIONS_LABEL_ID}
                >
                    <FormattedMessage {...messages.displayLabel}/>
                </span>
                <div className='ChannelsResourceSettings__control'>
                    <div
                        className='ChannelsResourceSettings__locations'
                        role='group'
                        aria-labelledby={LOCATIONS_LABEL_ID}
                    >
                        {CHANNEL_DISPLAY_LOCATIONS.map((location) => {
                            const checked = value.displayLocations.includes(location);
                            return (
                                <label
                                    key={location}
                                    className='ChannelsResourceSettings__checkbox'
                                >
                                    <input
                                        type='checkbox'
                                        className='ChannelsResourceSettings__checkboxInput'
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={(e) => handleLocationChange(location, e.target.checked)}
                                        data-testid={`channelsResourceLocation-${location}`}
                                    />
                                    <span
                                        className='ChannelsResourceSettings__checkboxBox'
                                        aria-hidden={true}
                                    >
                                        {checked && <CheckIcon size={12}/>}
                                    </span>
                                    <span className='ChannelsResourceSettings__checkboxLabel'>
                                        {displayLocationLabel(location, intl)}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <p className='ChannelsResourceSettings__help'>
                        <FormattedMessage {...messages.displayHelp}/>
                    </p>
                </div>
            </div>

            <div className='ChannelsResourceSettings__field'>
                <span className='ChannelsResourceSettings__label'>
                    <FormattedMessage {...messages.changePolicyLabel}/>
                </span>
                <div className='ChannelsResourceSettings__control'>
                    <Menu.Container
                        menuButton={{
                            id: 'channelsResourceChangePolicyButton',
                            class: 'ChannelsResourceSettings__selectButton',
                            disabled,
                            'aria-label': formatMessage(messages.changePolicyAriaLabel, {value: formatMessage(changePolicyLabel)}),
                            children: (
                                <>
                                    <FormattedMessage {...changePolicyLabel}/>
                                    <i className='icon icon-chevron-down'/>
                                </>
                            ),
                            dataTestId: 'channelsResourceChangePolicyButton',
                        }}
                        menu={{
                            id: 'channelsResourceChangePolicyMenu',
                            'aria-label': formatMessage(messages.changePolicyLabel),
                        }}
                    >
                        {changePolicies.map((policy) => (
                            <Menu.Item
                                id={`channelsResourceChangePolicy-${policy}`}
                                key={policy}
                                role='menuitemradio'
                                aria-checked={policy === value.changePolicy}
                                forceCloseOnSelect={true}
                                onClick={() => handleChangePolicySelect(policy)}
                                labels={<FormattedMessage {...changePolicyLabelFor(policy)}/>}
                            />
                        ))}
                    </Menu.Container>
                    {!ordered && (
                        <p className='ChannelsResourceSettings__help'>
                            <FormattedMessage {...messages.changePolicyUnorderedHelp}/>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const messages = defineMessages({
    on: {id: 'admin.global_attributes.applies_to.channels.toggle.on', defaultMessage: 'On'},
    off: {id: 'admin.global_attributes.applies_to.channels.toggle.off', defaultMessage: 'Off'},
    requiredLabel: {id: 'admin.global_attributes.applies_to.channels.required.label', defaultMessage: 'Required'},
    requiredOnHelp: {id: 'admin.global_attributes.applies_to.channels.required.help_on', defaultMessage: 'Required — the channel must have a value for this attribute before it can be created.'},
    requiredOffHelp: {id: 'admin.global_attributes.applies_to.channels.required.help_off', defaultMessage: 'Optional — this attribute can still be added to a channel after it is created.'},
    changePolicyLabel: {id: 'admin.global_attributes.applies_to.channels.change_policy.label', defaultMessage: 'Changing the value'},
    changePolicyAriaLabel: {id: 'admin.global_attributes.applies_to.channels.change_policy.aria_label', defaultMessage: 'Changing the value, currently {value}'},
    changePolicyUnorderedHelp: {id: 'admin.global_attributes.applies_to.channels.change_policy.unordered_help', defaultMessage: 'Raising and lowering need ranked values, so they are only offered on a Rank attribute.'},
    displayLabel: {id: 'admin.global_attributes.applies_to.channels.display.label', defaultMessage: 'Display location'},
    displayHelp: {id: 'admin.global_attributes.applies_to.channels.display.help', defaultMessage: 'Multiple locations can be selected. Uncheck all to keep it off the header and banner — Channel Info always shows the value.'},
});

export default ChannelsResourceSettings;
