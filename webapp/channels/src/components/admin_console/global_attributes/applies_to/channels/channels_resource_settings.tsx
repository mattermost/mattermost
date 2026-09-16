// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {CheckIcon} from '@mattermost/compass-icons/components';

import {isChannelAttributesRequiredEnabled} from 'mattermost-redux/selectors/entities/general';

import * as Menu from 'components/menu';

import ChannelsMissingValuesBanner from './channels_missing_values_banner';
import type {NotifyStatus} from './channels_missing_values_banner';
import {useChannelsWithoutValueModal} from './channels_without_value_modal';
import {useNotifyChannelAdmins} from './notify_channel_admins_modal';
import {changePolicyLabelFor, displayLocationLabel} from './summary';
import type {ChannelChangePolicy, ChannelDisplayLocation, ChannelResourceConfig} from './types';
import {CHANNEL_CHANGE_POLICIES, CHANNEL_DISPLAY_LOCATIONS, isOrderedChangePolicy} from './types';
import useChannelMissingValues from './use_channel_missing_values';

import {notifyChannelAdminsOfMissingValue} from '../../utils';

import './channels_resource_settings.scss';

// A constant, not generated per instance: an attribute applies to Channels at
// most once, so only one of these can exist on a page.
const LOCATIONS_LABEL_ID = 'channelsResourceLocationsLabel';
const MISSING_VALUES_BANNER_BODY_ID = 'channelsResourceMissingValuesBannerBody';

type Props = {
    value: ChannelResourceConfig;
    onChange: (next: ChannelResourceConfig) => void;

    // Whether the attribute's values have a defined order, i.e. it is rank-typed.
    // Raise-only and lower-only are meaningless without one, so they are not offered.
    ordered?: boolean;

    disabled?: boolean;

    // The persisted linked channel field's ID. Undefined in create mode --
    // the attribute has no ID yet, so "Notify all channel admins" has nothing
    // to point recipients at and is hidden.
    channelFieldId?: string;

    // For banner/modal copy. Falls back to a generic phrase when unset.
    attributeDisplayName?: string;
};

/**
 * The settings an attribute carries on channels: whether a value is required,
 * where it displays, and how it may change once set.
 *
 * Never dispatches and never saves, with one exception: the Required toggle's
 * banner offers "Notify all channel admins", which does perform its own POST
 * (see handleNotify) since there is nowhere else for that action to live.
 * Two hosts render this component — the Applies-to card's Channels row and
 * the Classification page — and each still owns its own Save.
 */
const ChannelsResourceSettings = ({value, onChange, ordered, disabled, channelFieldId, attributeDisplayName}: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;

    // ChannelAttributesRequired gates this toggle entirely rather than disabling
    // it: while enforcement is off there is no way to act on setting it, and
    // leaving it interactive would let an admin configure a state that quietly
    // does nothing until the flag is enabled.
    const requiredEnforcementEnabled = useSelector(isChannelAttributesRequiredEnabled);

    // This component only mounts while its host's Channels row is expanded,
    // so the fetch is already deferred until the admin actually looks at this
    // section -- do not lift this hook to an always-mounted ancestor without
    // preserving that property. Also tied to requiredEnforcementEnabled: while
    // the kill switch is off the Required field (and its banner) don't render
    // at all, so there is nothing for this fetch to feed.
    const missingValues = useChannelMissingValues({fieldId: channelFieldId, enabled: requiredEnforcementEnabled});
    const openChannelsWithoutValueModal = useChannelsWithoutValueModal();
    const promptNotifyChannelAdmins = useNotifyChannelAdmins();

    const [notifyStatus, setNotifyStatus] = useState<NotifyStatus>('idle');
    const [notifiedAdminCount, setNotifiedAdminCount] = useState<number>();
    const [notifiedTruncated, setNotifiedTruncated] = useState(false);
    const [attentionKey, setAttentionKey] = useState(0);
    const [attemptedEnable, setAttemptedEnable] = useState(false);
    const bannerRef = useRef<HTMLDivElement>(null);

    // Guards handleNotify's post-await setState: the component can unmount
    // (host collapses this row) or channelFieldId can change to a different
    // attribute (same instance, new props) while the notify request is still
    // in flight. Without this, a slow notify for field A can land after the
    // admin has switched to field B and stamp B's banner with A's result.
    const mountedRef = useRef(true);
    useEffect(() => () => {
        mountedRef.current = false;
    }, []);
    const channelFieldIdRef = useRef(channelFieldId);
    channelFieldIdRef.current = channelFieldId;

    const missingCount = missingValues.summary?.totalCount ?? 0;

    // Blocked only in the off -> on direction. Turning Required OFF must
    // always work: that is the escape hatch for a field that is already
    // required while channels are non-compliant (e.g. after an unarchive).
    const blockedByMissingValues = !value.required && missingCount > 0;

    const handleRequiredToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (blockedByMissingValues) {
            setAttentionKey((n) => n + 1);
            setAttemptedEnable(true);
            bannerRef.current?.scrollIntoView({block: 'nearest'});
            return;
        }
        onChange({...value, required: event.target.checked});
    }, [blockedByMissingValues, onChange, value]);

    const handleViewList = useCallback(() => {
        openChannelsWithoutValueModal({
            fieldId: channelFieldId,
            attributeDisplayName,
            totalCount: missingCount,
        });
    }, [openChannelsWithoutValueModal, channelFieldId, attributeDisplayName, missingCount]);

    const handleNotify = useCallback(async () => {
        if (!channelFieldId || !missingValues.summary) {
            return;
        }
        const notifyFieldId = channelFieldId;

        // Still targeting the field the admin actually confirmed for below
        // (the POST always goes out for notifyFieldId); this guard only
        // decides whether this component instance is still the right place
        // to reflect that result. Defined before the confirm await (not
        // just the POST await after it): the admin can switch fields or
        // this row can collapse/unmount while the confirmation modal itself
        // is still open, and the first thing that runs on the other side of
        // that await -- setNotifyStatus('notifying') -- must not skip the
        // same check the rest of this function already applies.
        const stillCurrent = () => mountedRef.current && channelFieldIdRef.current === notifyFieldId;

        const confirmed = await promptNotifyChannelAdmins({
            totalCount: missingValues.summary.totalCount,
            uniqueAdminCount: missingValues.summary.uniqueAdminCount,
            noAdminCount: missingValues.summary.noAdminCount,
            messagePreview: missingValues.summary.messagePreview,
            attributeDisplayName,
        });
        if (!confirmed || !stillCurrent()) {
            return;
        }

        setNotifyStatus('notifying');
        try {
            const result = await notifyChannelAdminsOfMissingValue(notifyFieldId);
            if (stillCurrent()) {
                setNotifiedAdminCount(result.notified_admin_count);
                setNotifiedTruncated(result.truncated);
                setNotifyStatus('notified');
            }
        } catch {
            if (stillCurrent()) {
                setNotifyStatus('notify_failed');
            }
        }
        if (stillCurrent()) {
            missingValues.reload();
        }
    }, [channelFieldId, missingValues, promptNotifyChannelAdmins, attributeDisplayName]);

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
                        {/* Permanently mounted with content swapped, so a live region
                            inserted at the same instant as its text is reliably
                            announced. role='status' (not 'alert'): this is
                            informational and present on load, not an interruption. */}
                        <div
                            ref={bannerRef}
                            role='status'
                            aria-live='polite'
                            className={attentionKey > 0 ? 'ChannelsResourceSettings__missingBanner--attention' : undefined}
                            onAnimationEnd={() => setAttentionKey(0)}
                        >
                            {missingCount > 0 && (
                                <ChannelsMissingValuesBanner
                                    count={missingCount}
                                    attributeDisplayName={attributeDisplayName}
                                    canNotify={Boolean(channelFieldId)}
                                    alreadyRequired={value.required}
                                    blocked={blockedByMissingValues}
                                    attemptedEnable={attemptedEnable}
                                    status={notifyStatus}
                                    notifiedAdminCount={notifiedAdminCount}
                                    notifiedTruncated={notifiedTruncated}
                                    bodyId={MISSING_VALUES_BANNER_BODY_ID}
                                    onNotify={handleNotify}
                                    onViewList={handleViewList}
                                />
                            )}
                        </div>
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
