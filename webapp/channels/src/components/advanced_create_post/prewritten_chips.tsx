// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';

import {trackEvent} from 'actions/telemetry_actions';

import Chip from 'components/common/chip/chip';

type Props = {
    prefillMessage: (msg: string, shouldFocus: boolean) => void;
    currentChannel: Channel;
    currentUserId: string;
    currentChannelTeammateUsername?: string;
}

const UsernameMention = styled.span`
    margin-left: 5px;
    color: var(--link-color);
`;

const ChipContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
`;

const PrewrittenChips = ({currentChannel, currentUserId, currentChannelTeammateUsername, prefillMessage}: Props) => {
    const {formatMessage} = useIntl();

    const chips = useMemo(() => {
        const customChip = {
            event: 'prefilled_message_selected_custom',
            message: defineMessage({
                id: '',
                defaultMessage: '',
            }),
            display: defineMessage({
                id: 'create_post.prewritten.custom',
                defaultMessage: 'Custom message...',
            }),
            leadingIcon: '',
        };

        if (currentChannel.type === 'O' || currentChannel.type === 'P' || currentChannel.type === 'G') {
            return [
                {
                    event: 'prefilled_message_selected_team_hi',
                    message: defineMessage({
                        id: 'create_post.prewritten.tip.team_hi_message',
                        defaultMessage: ':wave: Hi team!',
                    }),
                    display: defineMessage({
                        id: 'create_post.prewritten.tip.team_hi',
                        defaultMessage: 'Hi team!',
                    }),
                    leadingIcon: 'wave',
                },
                {
                    event: 'prefilled_message_selected_team_excited',
                    message: defineMessage({
                        id: 'create_post.prewritten.tip.team_excited_message',
                        defaultMessage: ':raised_hands: Excited to be here!',
                    }),
                    display: defineMessage({
                        id: 'create_post.prewritten.tip.team_excited',
                        defaultMessage: 'Excited to be here!',
                    }),
                    leadingIcon: 'raised_hands',
                },
                {
                    event: 'prefilled_message_selected_team_hey',
                    message: defineMessage({
                        id: 'create_post.prewritten.tip.team_hey_message',
                        defaultMessage: ':smile: Hey everyone!',
                    }),
                    display: defineMessage({
                        id: 'create_post.prewritten.tip.team_hey',
                        defaultMessage: 'Hey everyone!',
                    }),
                    leadingIcon: 'smile',
                },
                customChip,
            ];
        }

        if (currentChannel.teammate_id === currentUserId) {
            return [
                {
                    event: 'prefilled_message_selected_self_note',
                    message: defineMessage({
                        id: 'create_post.prewritten.tip.self_note',
                        defaultMessage: 'Note to self...',
                    }),
                    display: defineMessage({
                        id: 'create_post.prewritten.tip.self_note',
                        defaultMessage: 'Note to self...',
                    }),
                    leadingIcon: '',
                },
                {
                    event: 'prefilled_message_selected_self_should',
                    message: defineMessage({
                        id: 'create_post.prewritten.tip.self_should',
                        defaultMessage: 'Tomorrow I should...',
                    }),
                    display: defineMessage({
                        id: 'create_post.prewritten.tip.self_should',
                        defaultMessage: 'Tomorrow I should...',
                    }),
                    leadingIcon: '',
                },
                customChip,
            ];
        }

        return [
            {
                event: 'prefilled_message_selected_dm_hey',
                message: defineMessage({
                    id: 'create_post.prewritten.tip.dm_hey_message',
                    defaultMessage: ':wave: Hey @{username}',
                }),
                display: defineMessage({
                    id: 'create_post.prewritten.tip.dm_hey',
                    defaultMessage: 'Hey',
                }),
                leadingIcon: 'wave',
            },
            {
                event: 'prefilled_message_selected_dm_hello',
                message: defineMessage({
                    id: 'create_post.prewritten.tip.dm_hello_message',
                    defaultMessage: ':v: Oh hello',
                }),
                display: defineMessage({
                    id: 'create_post.prewritten.tip.dm_hello',
                    defaultMessage: 'Oh hello',
                }),
                leadingIcon: 'v',
            },
            customChip,
        ];
    }, [currentChannel, currentUserId]);

    return (
        <ChipContainer>
            {chips.map(({event, message, display, leadingIcon}) => {
                const values = {username: currentChannelTeammateUsername};
                const messageToPrefill = message.id ? formatMessage(
                    message,
                    values,
                ) : '';

                const additionalMarkup = message.id === 'create_post.prewritten.tip.dm_hey' ? (
                    <UsernameMention>
                        {'@'}{currentChannelTeammateUsername}
                    </UsernameMention>
                ) : null;

                return (
                    <Chip
                        key={display.id}
                        id={display.id}
                        defaultMessage={display.defaultMessage}
                        additionalMarkup={additionalMarkup}
                        values={values}
                        onClick={() => {
                            if (event) {
                                trackEvent('ui', event);
                            }
                            prefillMessage(messageToPrefill, true);
                        }}
                        otherOption={!message.id}
                        leadingIcon={leadingIcon}
                    />
                );
            })}
        </ChipContainer>
    );
};

export default memo(PrewrittenChips);
