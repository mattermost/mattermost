// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Bot as BotType} from '@mattermost/types/bots';
import type {UserAccessToken} from '@mattermost/types/users';

import Timestamp from 'components/timestamp';

type Props = {
    bot: BotType;
    tokens: Record<string, UserAccessToken>;
    show: boolean;
    onClose: () => void;
};

const BotTokensModal = ({
    bot,
    tokens,
    show,
    onClose,
}: Props) => {
    const {formatMessage} = useIntl();
    const tokenList = Object.values(tokens);

    return (
        <GenericModal
            show={show}
            onExited={onClose}
            modalHeaderText={formatMessage({
                id: 'bot.tokens.list.title',
                defaultMessage: 'Tokens for @{username}',
            }, {username: bot.username})}
            confirmButtonText={formatMessage({
                id: 'bot.tokens.list.close',
                defaultMessage: 'Close',
            })}
            handleConfirm={onClose}
            handleEnterKeyPress={onClose}
        >
            <div style={{padding: '20px 0'}}>
                {tokenList.length === 0 ? (
                    <div className='text-muted'>
                        <FormattedMessage
                            id='bot.tokens.list.empty'
                            defaultMessage='No tokens found for this bot.'
                        />
                    </div>
                ) : (
                    <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                        <table className='table'>
                            <thead>
                                <tr>
                                    <th>
                                        <FormattedMessage
                                            id='bot.tokens.list.id'
                                            defaultMessage='ID'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='bot.tokens.list.description'
                                            defaultMessage='Description'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='bot.tokens.list.created'
                                            defaultMessage='Created'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='bot.tokens.list.status'
                                            defaultMessage='Status'
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokenList.map((token) => (
                                    <tr key={token.id}>
                                        <td>
                                            <code
                                                style={{
                                                    fontSize: '12px',
                                                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                }}
                                            >
                                                {token.id.substring(0, 8)}
                                            </code>
                                        </td>
                                        <td>
                                            {token.description || (
                                                <span className='text-muted'>
                                                    {'—'}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <Timestamp value={token.create_at}/>
                                        </td>
                                        <td>
                                            {token.is_active ? (
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        backgroundColor: 'rgba(var(--online-indicator-rgb), 0.08)',
                                                        color: 'rgb(var(--online-indicator-rgb))',
                                                    }}
                                                >
                                                    <FormattedMessage
                                                        id='bot.tokens.list.active'
                                                        defaultMessage='Active'
                                                    />
                                                </span>
                                            ) : (
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        backgroundColor: 'rgba(var(--dnd-indicator-rgb), 0.08)',
                                                        color: 'rgb(var(--dnd-indicator-rgb))',
                                                    }}
                                                >
                                                    <FormattedMessage
                                                        id='bot.tokens.list.inactive'
                                                        defaultMessage='Inactive'
                                                    />
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </GenericModal>
    );
};

export default BotTokensModal;
