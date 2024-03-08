// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getChannel, makeGetChannel} from 'mattermost-redux/selectors/entities/channels';

import {trackEvent} from 'actions/telemetry_actions';

import Chip from 'components/common/chip/chip';

import {t} from 'utils/i18n';

import type {GlobalState} from 'types/store';

type Props = {
    prefillMessage: (msg: string, shouldFocus: boolean) => void;
    channelId: string;
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

const PrewrittenChips = ({channelId, currentUserId, currentChannelTeammateUsername, prefillMessage}: Props) => {
    const {formatMessage} = useIntl();
    const getChannelWithTeammate = useMemo(makeGetChannel, []);
    const channelType = useSelector((state: GlobalState) => getChannel(state, channelId)?.type || 'O');
    const channelTeammate = useSelector((state: GlobalState) => getChannelWithTeammate(state, {id: channelId})?.teammate_id || '');

    const chips = useMemo(() => {
        const customChip = {
            event: 'prefilled_message_selected_custom',
            messageId: '',
            message: '',
            displayId: t('create_post.prewritten.custom'),
            display: 'Custom message...',
            leadingIcon: '',
        };

        if (channelType === 'O' || channelType === 'P' || channelType === 'G') {
            return [
                {
                    event: 'prefilled_message_selected_team_hi',
                    messageId: t('create_post.prewritten.tip.team_hi_message'),
                    message: ':wave: Hi team!',
                    displayId: t('create_post.prewritten.tip.team_hi'),
                    display: 'Hi team!',
                    leadingIcon: 'wave',
                },
                {
                    event: 'prefilled_message_selected_team_excited',
                    messageId: t('create_post.prewritten.tip.team_excited_message'),
                    message: ':raised_hands: Excited to be here!',
                    displayId: t('create_post.prewritten.tip.team_excited'),
                    display: 'Excited to be here!',
                    leadingIcon: 'raised_hands',
                },
                {
                    event: 'prefilled_message_selected_team_hey',
                    messageId: t('create_post.prewritten.tip.team_hey_message'),
                    message: ':smile: Hey everyone!',
                    displayId: t('create_post.prewritten.tip.team_hey'),
                    display: 'Hey everyone!',
                    leadingIcon: 'smile',
                },
                customChip,
            ];
        }

        if (channelTeammate === currentUserId) {
            return [
                {
                    event: 'prefilled_message_selected_self_note',
                    messageId: t('create_post.prewritten.tip.self_note'),
                    message: 'Note to self...',
                    displayId: t('create_post.prewritten.tip.self_note'),
                    display: 'Note to self...',
                    leadingIcon: '',
                },
                {
                    event: 'prefilled_message_selected_self_should',
                    messageId: t('create_post.prewritten.tip.self_should'),
                    message: 'Tomorrow I should...',
                    displayId: t('create_post.prewritten.tip.self_should'),
                    display: 'Tomorrow I should...',
                    leadingIcon: '',
                },
                customChip,
            ];
        }

        return [
            {
                event: 'prefilled_message_selected_dm_hey',
                messageId: t('create_post.prewritten.tip.dm_hey_message'),
                message: ':wave: Hey @{username}',
                displayId: t('create_post.prewritten.tip.dm_hey'),
                display: 'Hey',
                leadingIcon: 'wave',
            },
            {
                event: 'prefilled_message_selected_dm_hello',
                messageId: t('create_post.prewritten.tip.dm_hello_message'),
                message: ':v: Oh hello',
                displayId: t('create_post.prewritten.tip.dm_hello'),
                display: 'Oh hello',
                leadingIcon: 'v',
            },
            customChip,
        ];
    }, [channelType, channelTeammate, currentUserId]);

    return (
        <ChipContainer>
            {chips.map(({event, messageId, message, displayId, display, leadingIcon}) => {
                const values = {username: currentChannelTeammateUsername};
                const messageToPrefill = messageId ? formatMessage(
                    {id: messageId, defaultMessage: message},
                    values,
                ) : message;

                const additionalMarkup = displayId === 'create_post.prewritten.tip.dm_hey' ? (
                    <UsernameMention>
                        {'@'}{currentChannelTeammateUsername}
                    </UsernameMention>
                ) : null;

                return (
                    <Chip
                        key={displayId}
                        id={displayId}
                        defaultMessage={display}
                        additionalMarkup={additionalMarkup}
                        values={values}
                        onClick={() => {
                            if (event) {
                                trackEvent('ui', event);
                            }
                            prefillMessage(messageToPrefill, true);
                        }}
                        otherOption={!messageId}
                        leadingIcon={leadingIcon}
                    />
                );
            })}
        </ChipContainer>
    );
};

export default memo(PrewrittenChips);
