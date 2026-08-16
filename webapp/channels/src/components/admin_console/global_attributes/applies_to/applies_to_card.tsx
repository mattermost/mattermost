// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';

import Card from 'components/card/card';

import ChannelsResourceRow, {DEFAULT_CHANNEL_RESOURCE_CONFIG} from './channels';
import type {ChannelResourceConfig} from './channels';

import './applies_to_card.scss';

type Props = {

    // null means the attribute does not apply to channels.
    channelResource: ChannelResourceConfig | null;
    onChannelResourceChange: (next: ChannelResourceConfig | null) => void;
    disabled?: boolean;
};

/**
 * Temporary host for the Channels resource row.
 *
 * Global Attributes owns the real "Applies to" card, which does not exist yet.
 * Delete this file when it lands; ChannelsResourceRow is the part that survives.
 */
const AppliesToCard = ({channelResource, onChannelResourceChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <Card
            expanded={true}
            disableExpandAnimation={true}
            className='console AppliesToCard'
        >
            <Card.Header>
                <div className='AppliesToCard__header'>
                    <div className='AppliesToCard__headingGroup'>
                        <div className='AppliesToCard__title'>
                            <FormattedMessage {...messages.title}/>
                        </div>
                        <p className='AppliesToCard__subtitle'>
                            <FormattedMessage {...messages.subtitle}/>
                        </p>
                    </div>
                    {!channelResource && (
                        <button
                            type='button'
                            className='AppliesToCard__addResource'
                            onClick={() => onChannelResourceChange({...DEFAULT_CHANNEL_RESOURCE_CONFIG})}
                            disabled={disabled}
                            data-testid='appliesToAddResource'
                            aria-label={formatMessage(messages.addResource)}
                        >
                            <PlusIcon size={14}/>
                            <FormattedMessage {...messages.addResource}/>
                        </button>
                    )}
                </div>
            </Card.Header>
            <Card.Body expanded={true}>
                {channelResource ? (
                    <ChannelsResourceRow
                        value={channelResource}
                        onChange={onChannelResourceChange}
                        onRemove={() => onChannelResourceChange(null)}
                        disabled={disabled}
                    />
                ) : (
                    <p
                        className='AppliesToCard__empty'
                        data-testid='appliesToEmpty'
                    >
                        <FormattedMessage {...messages.empty}/>
                    </p>
                )}
            </Card.Body>
        </Card>
    );
};

const messages = defineMessages({
    title: {id: 'admin.global_attributes.applies_to.title', defaultMessage: 'Applies to'},
    subtitle: {id: 'admin.global_attributes.applies_to.subtitle', defaultMessage: 'Resources this attribute applies to, and who can set the value on each.'},
    addResource: {id: 'admin.global_attributes.applies_to.add_resource', defaultMessage: 'Add resource'},
    empty: {id: 'admin.global_attributes.applies_to.empty', defaultMessage: 'This attribute does not apply to any resource yet.'},
});

export default AppliesToCard;
