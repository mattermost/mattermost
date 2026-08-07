// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {DeliveryTrackingConfig} from '@mattermost/types/delivery_tracking';

import {Label} from 'components/admin_console/boolean_setting';
import ChannelMultiSelector from 'components/admin_console/content_flagging/delivery_tracking/channel_multiselector';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';
import BetaTag from 'components/widgets/tag/beta_tag';

import '../content_flagging_section_base.scss';
import './delivery_tracking_section.scss';

type Props = {
    value: DeliveryTrackingConfig;
    onChange: (value: DeliveryTrackingConfig) => void;
    hasError?: boolean;
};

// Unlike the other Data Spillage sections, this one takes no `disabled` prop. Post delivery
// audit logging is governed only by its own toggle and channel list, so it stays editable
// when EnableContentFlagging is off.
export default function DeliveryTrackingSection({value, onChange, hasError = false}: Props) {
    const handleEnableChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({...value, Enable: e.target.value === 'true'});
    }, [value, onChange]);

    const handleAllChannelsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({...value, EnableForAllChannels: e.target.value === 'true'});
    }, [value, onChange]);

    const handleChannelsChange = useCallback((channelIds: string[]) => {
        onChange({...value, ChannelIds: channelIds});
    }, [value, onChange]);

    return (
        <AdminSection data-testid='deliveryTrackingSection'>
            <SectionHeader>
                <hgroup>
                    <h1 className='content-flagging-section-title deliveryTracking-section-title'>
                        <FormattedMessage
                            id='admin.dataSpillage.deliveryTracking.title'
                            defaultMessage='Post Delivery Audit Logging'
                        />
                        <BetaTag variant='default'/>
                    </h1>
                    <h5 className='content-flagging-section-description'>
                        <FormattedMessage
                            id='admin.dataSpillage.deliveryTracking.description'
                            defaultMessage="Record an audit log entry each time a message is delivered to a user, so you can determine who a quarantined message reached. Delivery records add storage and processing cost, so enable them only where they're needed."
                        />
                    </h5>
                </hgroup>
            </SectionHeader>

            <SectionContent>
                <div className='content-flagging-section-setting-wrapper'>
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.dataSpillage.deliveryTracking.enable'
                                defaultMessage='Enable post delivery audit logging'
                            />
                        </div>

                        <div className='setting-content-wrapper'>
                            <div className='setting-content'>
                                <Label isDisabled={false}>
                                    <input
                                        data-testid='deliveryTrackingEnable_true'
                                        type='radio'
                                        value='true'
                                        checked={value.Enable}
                                        onChange={handleEnableChange}
                                    />
                                    <FormattedMessage
                                        id='admin.true'
                                        defaultMessage='True'
                                    />
                                </Label>

                                <Label isDisabled={false}>
                                    <input
                                        data-testid='deliveryTrackingEnable_false'
                                        type='radio'
                                        value='false'
                                        checked={!value.Enable}
                                        onChange={handleEnableChange}
                                    />
                                    <FormattedMessage
                                        id='admin.false'
                                        defaultMessage='False'
                                    />
                                </Label>
                            </div>

                            <div className='helpText'>
                                <FormattedMessage
                                    id='admin.dataSpillage.deliveryTracking.enable.help'
                                    defaultMessage='When true, an audit log entry is recorded each time a message is delivered to a user. These records are written to the audit log only and are not surfaced anywhere in the Mattermost interface.'
                                />
                            </div>
                        </div>
                    </div>

                    {value.Enable && (
                        <div className='content-flagging-section-setting'>
                            <div className='setting-title'>
                                <FormattedMessage
                                    id='admin.dataSpillage.deliveryTracking.trackIn'
                                    defaultMessage='Record deliveries in'
                                />
                            </div>

                            <div className='setting-content-wrapper'>
                                <div className='setting-content'>
                                    <Label isDisabled={false}>
                                        <input
                                            data-testid='deliveryTrackingAllChannels_true'
                                            type='radio'
                                            value='true'
                                            checked={value.EnableForAllChannels}
                                            onChange={handleAllChannelsChange}
                                        />
                                        <FormattedMessage
                                            id='admin.dataSpillage.deliveryTracking.trackIn.allChannels'
                                            defaultMessage='All channels'
                                        />
                                    </Label>

                                    <Label isDisabled={false}>
                                        <input
                                            data-testid='deliveryTrackingAllChannels_false'
                                            type='radio'
                                            value='false'
                                            checked={!value.EnableForAllChannels}
                                            onChange={handleAllChannelsChange}
                                        />
                                        <FormattedMessage
                                            id='admin.dataSpillage.deliveryTracking.trackIn.selectedChannels'
                                            defaultMessage='Selected channels'
                                        />
                                    </Label>
                                </div>

                                <div className='helpText'>
                                    <FormattedMessage
                                        id='admin.dataSpillage.deliveryTracking.trackIn.help'
                                        defaultMessage='Recording deliveries in all channels is the most complete option, but also the most expensive. Limit it to the channels where data spillage matters to keep storage and performance in check.'
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {value.Enable && !value.EnableForAllChannels && (
                        <div className='content-flagging-section-setting'>
                            <div className='setting-title'>
                                <FormattedMessage
                                    id='admin.dataSpillage.deliveryTracking.channels'
                                    defaultMessage='Channels to record deliveries in'
                                />
                            </div>

                            <div className='setting-content-wrapper'>
                                <div className='setting-content'>
                                    <ChannelMultiSelector
                                        id='delivery_tracking_channels'
                                        channelIds={value.ChannelIds}
                                        onChange={handleChannelsChange}
                                        hasError={hasError}
                                    />
                                </div>

                                {hasError ? (
                                    <div className='deliveryTracking-error'>
                                        <FormattedMessage
                                            id='admin.dataSpillage.deliveryTracking.channels.required'
                                            defaultMessage='Select at least one channel, or choose All channels.'
                                        />
                                    </div>
                                ) : (
                                    <div className='helpText'>
                                        <FormattedMessage
                                            id='admin.dataSpillage.deliveryTracking.channels.help'
                                            defaultMessage='Deliveries are recorded only in these channels. Recording starts when you save and applies to messages sent from then on.'
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </SectionContent>
        </AdminSection>
    );
}
