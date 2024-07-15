// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getChannel, getDirectTeammate} from 'mattermost-redux/selectors/entities/channels';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {trackEvent} from 'actions/telemetry_actions';

import Chip from 'components/common/chip/chip';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    prefillMessage: (msg: string, shouldFocus: boolean) => void;
    channelId: string;
    currentUserId: string;
}

const UsernameMention = styled.span`
    margin-left: 5px;
    color: var(--link-color);
`;

const ChipContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
`;

const PrewrittenChips = ({channelId, currentUserId, prefillMessage}: Props) => {
    const {formatMessage} = useIntl();
    const channelType = useSelector((state: GlobalState) => getChannel(state, channelId)?.type || Constants.OPEN_CHANNEL);
    const channelTeammateId = useSelector((state: GlobalState) => getDirectTeammate(state, channelId)?.id || '');
    const channelTeammateUsername = useSelector((state: GlobalState) => getUser(state, channelTeammateId)?.username || '');

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

        if (
            channelType === Constants.OPEN_CHANNEL ||
            channelType === Constants.PRIVATE_CHANNEL ||
            channelType === Constants.GM_CHANNEL
        ) {
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

        if (channelTeammateId === currentUserId) {
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
    }, [channelType, channelTeammateId, currentUserId]);

    return (
        <ChipContainer>
            {chips.map(({event, message, display, leadingIcon}) => {
                const values = {username: channelTeammateUsername};
                const messageToPrefill = message.id ? formatMessage(
                    message,
                    values,
                ) : '';

                const additionalMarkup = message.id === 'create_post.prewritten.tip.dm_hey' ? (
                    <UsernameMention>
                        {'@'}{channelTeammateUsername}
                    </UsernameMention>
                ) : null;

                return (
                    <Chip
                        key={display.id}
                        display={display}
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
