// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel, isPropertyFieldEditable} from 'mattermost-redux/utils/property_utils';

import useChannelInfoAttributes from 'components/common/hooks/useChannelInfoAttributes';

import AttributeChip from './attribute_chip';

import './channel_info_attributes.scss';

function optionColor(attribute: ResolvedChannelAttribute): string | undefined {
    const color = attribute.option?.color;
    return typeof color === 'string' && color ? color : undefined;
}

type Props = {
    channelId: string;
};

/**
 * The CHANNEL ATTRIBUTES block in Channel Info.
 *
 * Read-only here. A locked attribute is shown with the reason rather than
 * hidden: hiding it would make a channel that is correctly configured look like
 * one missing a marking.
 */
const ChannelInfoAttributes = ({channelId}: Props) => {
    const {formatMessage} = useIntl();
    const attributes = useChannelInfoAttributes(channelId);

    if (attributes.length === 0) {
        return null;
    }

    return (
        <div
            className='ChannelInfoAttributes'
            data-testid='channelInfoAttributes'
        >
            <div className='ChannelInfoAttributes__heading'>
                <FormattedMessage
                    id='channel_attributes.info.heading'
                    defaultMessage='Channel Attributes'
                />
            </div>

            {attributes.map((attribute) => {
                const label = getPropertyFieldLabel(attribute.field);
                const locked = !isPropertyFieldEditable(attribute.field);

                return (
                    <div
                        key={attribute.field.id}
                        className='ChannelInfoAttributes__row'
                        data-testid={`channelInfoAttributeRow-${attribute.field.name}`}
                    >
                        <span className='ChannelInfoAttributes__label'>
                            {label}
                            {locked && (
                                <LockOutlineIcon
                                    size={12}
                                    aria-label={formatMessage({
                                        id: 'channel_attributes.info.locked',
                                        defaultMessage: 'This attribute cannot be changed after it is set',
                                    })}
                                />
                            )}
                        </span>

                        <span className='ChannelInfoAttributes__value'>
                            {attribute.displayValue ? (
                                <AttributeChip
                                    label={label}
                                    value={attribute.displayValue}
                                    color={optionColor(attribute)}
                                    announceLabel={false}
                                />
                            ) : (

                                // Only reachable for a required attribute: an unset
                                // optional one is not listed at all. The empty state
                                // is what tells a channel admin it needs filling.
                                <span className='ChannelInfoAttributes__empty'>
                                    <FormattedMessage
                                        id='channel_attributes.info.not_set'
                                        defaultMessage='Not set'
                                    />
                                </span>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default ChannelInfoAttributes;
