// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage, useIntl, defineMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Bot as BotType} from '@mattermost/types/bots';
import type {UserAccessToken} from '@mattermost/types/users';

import CopyText from 'components/copy_text';

type Props = {
    bot: BotType;
    show: boolean;
    onClose: () => void;
    onCreateToken: (userId: string, description: string) => Promise<{data?: UserAccessToken; error?: {message: string}}>;
};

const CreateBotTokenModal = ({
    bot,
    show,
    onClose,
    onCreateToken,
}: Props) => {
    const {formatMessage} = useIntl();
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);
    const [createdToken, setCreatedToken] = useState<UserAccessToken | null>(null);

    const handleCreate = useCallback(async () => {
        if (description.trim() === '') {
            setError(formatMessage({
                id: 'bot.token.error.description',
                defaultMessage: 'Please enter a description.',
            }));
            return;
        }

        setIsCreating(true);
        setError('');

        const result = await onCreateToken(bot.user_id, description);

        setIsCreating(false);

        if (result.data) {
            setCreatedToken(result.data);
        } else if (result.error) {
            setError(result.error.message);
        }
    }, [bot.user_id, description, onCreateToken, formatMessage]);

    const handleClose = useCallback(() => {
        setDescription('');
        setError('');
        setCreatedToken(null);
        onClose();
    }, [onClose]);

    const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDescription(e.target.value);
        setError('');
    }, []);

    // If token was created, show the token
    if (createdToken) {
        return (
            <GenericModal
                show={show}
                onExited={handleClose}
                modalHeaderText={formatMessage({
                    id: 'bot.token.created.title',
                    defaultMessage: 'Token Created',
                })}
                confirmButtonText={formatMessage({
                    id: 'bot.token.created.done',
                    defaultMessage: 'Done',
                })}
                handleConfirm={handleClose}
                handleEnterKeyPress={handleClose}
            >
                <div style={{padding: '20px 0'}}>
                    <div className='alert alert-warning'>
                        <i
                            className='icon icon-alert-outline'
                            style={{marginRight: '8px'}}
                        />
                        <FormattedMessage
                            id='bot.token.created.warning'
                            defaultMessage="Make sure to copy your new personal access token now. You won't be able to see it again!"
                        />
                    </div>
                    <div style={{marginTop: '20px'}}>
                        <div
                            className='control-label'
                            style={{fontWeight: 600, marginBottom: '8px', display: 'block'}}
                        >
                            <FormattedMessage
                                id='bot.token.created.token'
                                defaultMessage='Token'
                            />
                        </div>
                        <div
                            className='d-flex align-items-center'
                            style={{gap: '8px'}}
                        >
                            <code
                                style={{
                                    flex: 1,
                                    fontSize: '14px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                }}
                            >
                                {createdToken.token}
                            </code>
                            <CopyText
                                value={createdToken.token || ''}
                                label={defineMessage({
                                    id: 'bot.token.copy',
                                    defaultMessage: 'Copy Token',
                                })}
                            />
                        </div>
                    </div>
                    {createdToken.description && (
                        <div style={{marginTop: '16px'}}>
                            <div
                                className='control-label'
                                style={{fontWeight: 600, marginBottom: '8px', display: 'block'}}
                            >
                                <FormattedMessage
                                    id='bot.token.created.description'
                                    defaultMessage='Description'
                                />
                            </div>
                            <div>{createdToken.description}</div>
                        </div>
                    )}
                </div>
            </GenericModal>
        );
    }

    // Show the create form
    return (
        <GenericModal
            show={show}
            onExited={handleClose}
            modalHeaderText={formatMessage({
                id: 'bot.token.create.title',
                defaultMessage: 'Create Token',
            })}
            confirmButtonText={formatMessage({
                id: 'bot.token.create.confirm',
                defaultMessage: 'Create Token',
            })}
            cancelButtonText={formatMessage({
                id: 'bot.token.create.cancel',
                defaultMessage: 'Cancel',
            })}
            handleConfirm={handleCreate}
            handleCancel={handleClose}
            handleEnterKeyPress={handleCreate}
            isConfirmDisabled={isCreating || description.trim() === ''}
        >
            <div style={{padding: '20px 0'}}>
                <div style={{marginBottom: '20px'}}>
                    <FormattedMessage
                        id='bot.token.create.description_help'
                        defaultMessage='Enter a description for the token for @{username}.'
                        values={{username: bot.username}}
                    />
                </div>
                <div>
                    <label
                        className='control-label'
                        htmlFor='tokenDescription'
                        style={{fontWeight: 600, marginBottom: '8px', display: 'block'}}
                    >
                        <FormattedMessage
                            id='user.settings.tokens.name'
                            defaultMessage='Token Description: '
                        />
                    </label>
                    <input
                        id='tokenDescription'
                        className='form-control'
                        type='text'
                        maxLength={64}
                        value={description}
                        onChange={handleDescriptionChange}
                        autoFocus={true}
                        placeholder={formatMessage({
                            id: 'bot.token.create.description_placeholder',
                            defaultMessage: 'Enter a description for your token',
                        })}
                    />
                </div>
                {error && (
                    <div
                        className='alert alert-danger'
                        style={{marginTop: '16px', marginBottom: 0}}
                    >
                        {error}
                    </div>
                )}
            </div>
        </GenericModal>
    );
};

export default CreateBotTokenModal;
