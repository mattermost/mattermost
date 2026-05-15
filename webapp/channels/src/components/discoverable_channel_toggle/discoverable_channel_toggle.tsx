// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useCallback, useId} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, ChevronUpIcon} from '@mattermost/compass-icons/components';

import Toggle from 'components/toggle';

import './discoverable_channel_toggle.scss';

type Props = {
    id?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
};

// Surface that lets an admin mark a private channel as discoverable. The
// "Help me decide" expander mirrors the access matrix from the product spec
// so admins understand what they're enabling before flipping the switch.
function DiscoverableChannelToggle({
    id,
    checked,
    onChange,
    disabled,
}: Props) {
    const {formatMessage} = useIntl();
    const reactId = useId();
    const helpRegionId = `${id ?? reactId}-help`;
    const [expanded, setExpanded] = useState(false);

    const toggleExpanded = useCallback(() => {
        setExpanded((prev) => !prev);
    }, []);

    const handleToggle = useCallback(() => {
        if (disabled) {
            return;
        }
        onChange(!checked);
    }, [disabled, checked, onChange]);

    const heading = formatMessage({
        id: 'channel_settings.discoverable.title',
        defaultMessage: 'Discoverable private channel',
    });
    const subheading = formatMessage({
        id: 'channel_settings.discoverable.description',
        defaultMessage: 'Let other members find this channel in Browse Channels and ask to join.',
    });

    return (
        <div className='DiscoverableChannelToggle'>
            <div className='DiscoverableChannelToggle__header'>
                <div className='DiscoverableChannelToggle__text'>
                    <label
                        className='DiscoverableChannelToggle__title Input_legend'
                        aria-label={heading}
                    >
                        {heading}
                    </label>
                    <label
                        className='DiscoverableChannelToggle__subtitle Input_subheading'
                        aria-label={subheading}
                    >
                        {subheading}
                    </label>
                </div>
                <Toggle
                    id={id ?? 'channelDiscoverableToggle'}
                    ariaLabel={heading}
                    size='btn-md'
                    onToggle={handleToggle}
                    toggled={checked && !disabled}
                    disabled={disabled}
                    tabIndex={disabled ? -1 : 0}
                    toggleClassName='btn-toggle-primary'
                />
            </div>

            <button
                type='button'
                className='DiscoverableChannelToggle__helpButton'
                aria-expanded={expanded}
                aria-controls={helpRegionId}
                onClick={toggleExpanded}
            >
                <FormattedMessage
                    id='channel_settings.discoverable.help.label'
                    defaultMessage='Help me decide'
                />
                {expanded ? <ChevronUpIcon size={16}/> : <ChevronDownIcon size={16}/>}
            </button>

            <div
                id={helpRegionId}
                className={classNames('DiscoverableChannelToggle__help', {expanded})}
                role='region'
                hidden={!expanded}
            >
                <p className='DiscoverableChannelToggle__helpIntro'>
                    <FormattedMessage
                        id='channel_settings.discoverable.help.intro'
                        defaultMessage='Discoverable private channels appear in Browse Channels. Joining depends on whether an access policy is set:'
                    />
                </p>
                <ul className='DiscoverableChannelToggle__helpList'>
                    <li>
                        <strong>
                            <FormattedMessage
                                id='channel_settings.discoverable.help.policy.title'
                                defaultMessage='With an access policy'
                            />
                        </strong>
                        <span>
                            <FormattedMessage
                                id='channel_settings.discoverable.help.policy.body'
                                defaultMessage='Users who match the policy can join directly. Users who do not, will not see the channel.'
                            />
                        </span>
                    </li>
                    <li>
                        <strong>
                            <FormattedMessage
                                id='channel_settings.discoverable.help.no_policy.title'
                                defaultMessage='Without an access policy'
                            />
                        </strong>
                        <span>
                            <FormattedMessage
                                id='channel_settings.discoverable.help.no_policy.body'
                                defaultMessage='Anyone in the team sees the channel and can request to join. A channel admin must approve before they can post.'
                            />
                        </span>
                    </li>
                    <li>
                        <strong>
                            <FormattedMessage
                                id='channel_settings.discoverable.help.guests.title'
                                defaultMessage='Guests'
                            />
                        </strong>
                        <span>
                            <FormattedMessage
                                id='channel_settings.discoverable.help.guests.body'
                                defaultMessage='Guests never see discoverable channels they are not already a member of.'
                            />
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default DiscoverableChannelToggle;
