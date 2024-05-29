// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {components} from 'react-select';
import type {IndicatorProps, OptionProps, SingleValueProps, ValueType, OptionTypeBase} from 'react-select';
import AsyncSelect from 'react-select/async';

import {
    ArchiveOutlineIcon, ChevronDownIcon,
    GlobeIcon,
    LockOutlineIcon,
    MessageTextOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {getDirectTeammate} from 'mattermost-redux/selectors/entities/channels';
import {getMyTeams, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import type {ProviderResult} from 'components/suggestion/provider';
import SwitchChannelProvider from 'components/suggestion/switch_channel_provider';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import Constants from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {getBaseStyles} from './forward_post_channel_select_styles';

type ChannelTypeFromProvider = Channel & {
    userId?: string;
}

export type ChannelOption = {
    label: string;
    value: string;
    details: ChannelTypeFromProvider;
}

type GroupedOption = {
    label: React.ReactNode;
    options: ChannelOption[];
}

export const makeSelectedChannelOption = (channel: Channel): ChannelOption => ({
    label: channel.display_name || channel.name,
    value: channel.id,
    details: channel,
});

const FormattedOption = (props: ChannelOption & {className: string; isSingleValue?: boolean}) => {
    const {details} = props;

    const {formatMessage} = useIntl();

    const currentUserId = useSelector((state: GlobalState) => getCurrentUserId(state));
    const user = useSelector((state: GlobalState) => getUser(state, details.userId || ''));
    const status = useSelector((state: GlobalState) => getStatusForUserId(state, details.userId || ''));
    const teammate = useSelector((state: GlobalState) => getDirectTeammate(state, details.id));
    const team = useSelector((state: GlobalState) => getTeam(state, details.team_id));
    const userImageUrl = user?.id && Utils.imageURLForUser(user.id, user.last_picture_update);
    const isPartOfOnlyOneTeam = useSelector((state: GlobalState) => getMyTeams(state).length === 1);

    const channelIsArchived = details.delete_at > 0;

    let icon;
    const iconProps = {
        size: 16,
        color: 'rgba(var(--center-channel-color-rgb), 0.75)',
    };

    if (channelIsArchived) {
        icon = <ArchiveOutlineIcon {...iconProps}/>;
    } else if (details.type === Constants.OPEN_CHANNEL) {
        icon = <GlobeIcon {...iconProps}/>;
    } else if (details.type === Constants.PRIVATE_CHANNEL) {
        icon = <LockOutlineIcon {...iconProps}/>;
    } else if (details.type === Constants.THREADS) {
        icon = <MessageTextOutlineIcon {...iconProps}/>;
    } else if (details.type === Constants.GM_CHANNEL) {
        icon = <div className='status status--group'>{'G'}</div>;
    } else {
        icon = (
            <ProfilePicture
                src={userImageUrl}
                status={teammate && teammate.is_bot ? undefined : status}
                size='sm'
            />
        );
    }

    let customStatus = null;

    let name = details.display_name;
    let description = `~${details.name}`;

    let tag = null;
    if (details.type === Constants.DM_CHANNEL) {
        if (teammate?.is_bot) {
            tag = <BotTag/>;
        } else if (isGuest(teammate?.roles ?? '')) {
            tag = <GuestTag/>;
        }

        const emojiStyle = {
            marginBottom: 2,
            marginLeft: 8,
        };

        customStatus = (
            <CustomStatusEmoji
                showTooltip={true}
                userID={user.id}
                emojiStyle={emojiStyle}
            />
        );

        const deactivated = user.delete_at ? ` - ${formatMessage({id: 'channel_switch_modal.deactivated', defaultMessage: 'Deactivated'})}` : '';

        if (details.display_name && !teammate?.is_bot) {
            description = `@${user.username}${deactivated}`;
        } else {
            name = user.username;
            if (user.id === currentUserId) {
                name += ` ${formatMessage({id: 'suggestion.user.isCurrent', defaultMessage: '(you)'})}`;
            }
            description = deactivated;
        }
    } else if (details.type === Constants.GM_CHANNEL) {
        // remove the slug from the option
        name = details.display_name;
        description = '';
    }

    const sharedIcon = details.shared ? (
        <SharedChannelIndicator
            className='shared-channel-icon'
            channelType={details.type}
        />
    ) : null;

    const teamName = details.team_id && team ? (
        <span className='option__team-name'>{team.display_name}</span>
    ) : null;

    const componentType = props.isSingleValue ? 'singleValue' : 'option';

    const componentId = `post-forward_channel-select_${componentType}_${details.id}`;

    return (
        <div
            id={componentId}
            className={props.className}
            data-testid={details.name}
            aria-label={name}
        >
            {icon}
            <span className='option__content'>
                <span className='option__content--text'>{name}</span>
                {(isPartOfOnlyOneTeam || details.type === Constants.DM_CHANNEL) && description && (
                    <span className='option__content--description'>{description}</span>
                )}
                {customStatus}
                {sharedIcon}
                {tag}
            </span>
            {!isPartOfOnlyOneTeam && teamName}
        </div>
    );
};

const Option = (props: OptionProps<ChannelOption>) => {
    const {data} = props;

    const teammate = useSelector((state: GlobalState) => getDirectTeammate(state, data.details.id));

    if (teammate?.is_bot) {
        return null;
    }

    return (
        <components.Option {...props}>
            <FormattedOption
                {...data}
                className='option'
            />
        </components.Option>
    );
};

const SingleValue = (props: SingleValueProps<ChannelOption>) => {
    const {data} = props;

    return (
        <components.SingleValue {...props}>
            <FormattedOption
                {...data}
                isSingleValue={true}
                className='singleValue'
            />
        </components.SingleValue>
    );
};

const DropdownIndicator = (props: IndicatorProps<ChannelOption>) => {
    return (
        <components.DropdownIndicator {...props}>
            <ChevronDownIcon
                size={16}
                color={'rgba(var(--center-channel-color-rgb), 0.75)'}
            />
        </components.DropdownIndicator>
    );
};

type Props<O extends OptionTypeBase> = {
    onSelect: (channel: ValueType<O>) => void;
    currentBodyHeight: number;
    value?: O;
    validChannelTypes?: string[];
}

function ForwardPostChannelSelect({onSelect, value, currentBodyHeight, validChannelTypes = ['O', 'P', 'D', 'G']}: Props<ChannelOption>) {
    const {formatMessage} = useIntl();
    const {current: provider} = useRef<SwitchChannelProvider>(new SwitchChannelProvider());

    useEffect(() => {
        provider.forceDispatch = true;
    }, [provider]);

    const baseStyles = getBaseStyles(currentBodyHeight);

    const isValidChannelType = (channel: Channel) => validChannelTypes.includes(channel.type) && !channel.delete_at;

    const getDefaultResults = () => {
        let options: GroupedOption[] = [];

        const handleDefaultResults = (res: ProviderResult<any>) => {
            options = [
                {
                    label: formatMessage({id: 'suggestion.mention.recent.channels', defaultMessage: 'Recent'}),
                    options: res.items.filter((item) => item?.channel && isValidChannelType(item.channel) && !item.deactivated).map((item) => {
                        const {channel} = item;
                        return makeSelectedChannelOption(channel);
                    }),
                },
            ];
        };

        provider.fetchAndFormatRecentlyViewedChannels(handleDefaultResults);
        return options;
    };

    const defaultOptions = useRef<GroupedOption[]>(getDefaultResults());

    const handleInputChange = (inputValue: string) => {
        return new Promise<ChannelOption[]>((resolve) => {
            let callCount = inputValue ? 0 : 1;
            const options: ChannelOption[] = [];

            /** we optimistically assume this callback gets invoked twice when we have a value to be passed into the provider.
             * If, for some reason, we decide to change the behavior of the provider we should change the handling here as well.
             * A comment will be added to the repective section of the provider as well.
             *
             * @see {@link components/suggestion/switch_channel_provider.jsx}
             */
            const handleResults = async (res: ProviderResult<any>) => {
                callCount++;
                await res.items.filter((item) => item?.channel && isValidChannelType(item.channel) && !item.deactivated).forEach((item) => {
                    const {channel} = item;

                    if (options.findIndex((option) => option.value === channel.id) === -1) {
                        options.push(makeSelectedChannelOption(channel));
                    }
                });

                if (callCount === 2) {
                    resolve(options);
                }
            };

            provider.handlePretextChanged(inputValue, handleResults);
        });
    };

    return (
        <AsyncSelect
            value={value}
            onChange={onSelect}
            loadOptions={handleInputChange}
            defaultOptions={defaultOptions.current}
            components={{DropdownIndicator, Option, SingleValue}}
            styles={baseStyles}
            legend='Forward to'
            placeholder='Select channel or people'
            className='forward-post__select'
            data-testid='forward-post-select'
        />
    );
}

export default ForwardPostChannelSelect;
