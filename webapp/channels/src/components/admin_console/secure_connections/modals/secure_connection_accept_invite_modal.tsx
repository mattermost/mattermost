// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ClientError} from '@mattermost/client';
import {GenericModal} from '@mattermost/components';
import type {RemoteCluster, RemoteClusterAcceptInvite} from '@mattermost/types/remote_clusters';
import type {PartialExcept} from '@mattermost/types/utilities';

import LoadingScreen from 'components/loading_screen';
import Input from 'components/widgets/inputs/input/input';

import {ModalFieldset, ModalParagraph} from '../controls';
import TeamSelector from '../team_selector';
import {isErrorState, isPendingState, useTeamOptions} from '../utils';

type Props = {
    creating?: boolean;
    password?: string;
    onConfirm: (accept: PartialExcept<RemoteClusterAcceptInvite, 'display_name' | 'default_team_id' | 'invite' | 'password'>) => Promise<RemoteCluster>;
    onCancel?: () => void;
    onExited: () => void;
    onHide: () => void;
}

const noop = () => {};

function SecureConnectionAcceptInviteModal({
    onExited,
    onCancel,
    onConfirm,
    onHide,
}: Props) {
    const {formatMessage} = useIntl();
    const [displayName, setDisplayName] = useState('');
    const [defaultTeamId, setDefaultTeamId] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState<boolean | ClientError>(false);

    const teamsById = useTeamOptions();

    const need = {
        displayName: !displayName,
        defaultTeamId: !defaultTeamId,
        inviteCode: !inviteCode,
        password: !password,
    };

    const formFilled = Object.values(need).every((x) => !x);

    const handleConfirm = async () => {
        setSaving(true);

        try {
            await onConfirm({
                display_name: displayName,
                default_team_id: defaultTeamId,
                invite: inviteCode,
                password,
            });
            setSaving(false);
            onHide();
        } catch (err) {
            setSaving(err);
        }
    };

    const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayName(e.target.value);
    };

    const handleInviteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInviteCode(e.target.value);
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    };

    const title = formatMessage({
        id: 'admin.secure_connections.accept_invite.share_title',
        defaultMessage: 'Accept a connection invite',
    });

    const confirmButtonText = formatMessage({
        id: 'admin.secure_connections.accept_invite.confirm.done.button',
        defaultMessage: 'Accept',
    });

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            isConfirmDisabled={!formFilled || isPendingState(saving)}
            handleCancel={onCancel ?? noop}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            bodyOverflowVisible={true}
            autoCloseOnConfirmButton={false}
            errorText={isErrorState(saving) && (
                <FormattedMessage
                    id='admin.secure_connections.accept_invite.saving_changes_error'
                    defaultMessage='There was an error while accepting the invite.'
                />
            )}
        >
            {isPendingState(saving) ? (
                <LoadingScreen/>
            ) : (
                <>
                    <FormattedMessage
                        id={'admin.secure_connections.accept_invite.prompt'}
                        defaultMessage={'Accept a secure connection from another server'}
                        tagName={ModalParagraph}
                    />
                    <ModalFieldset>
                        <Input
                            type='text'
                            name='display-name'
                            containerClassName='secure-connections-modal-input'
                            placeholder={formatMessage({
                                id: 'admin.secure_connections.accept_invite.organization_name',
                                defaultMessage: 'Organization name',
                            })}
                            value={displayName}
                            onChange={handleDisplayNameChange}
                            data-testid='display-name'
                        />

                        <FormattedMessage
                            id={'admin.secure_connections.accept_invite.select_team'}
                            defaultMessage={'Please select the destination team where channels will be placed.'}
                            tagName={ModalParagraph}
                        />
                        <TeamSelector
                            testId='destination-team-input'
                            value={defaultTeamId}
                            teamsById={teamsById}
                            onChange={setDefaultTeamId}
                            legend={formatMessage({
                                id: 'admin.secure_connections.accept_invite.select_team.legend',
                                defaultMessage: 'Select a team',
                            })}
                        />

                        <FormattedMessage
                            id={'admin.secure_connections.accept_invite.prompt_invite_password'}
                            defaultMessage={'Enter the encrypted invitation code shared to you by the admin of the server you are connecting with.'}
                            tagName={ModalParagraph}
                        />
                        <Input
                            type='text'
                            name='invite-code'
                            containerClassName='secure-connections-modal-input'
                            placeholder={formatMessage({
                                id: 'admin.secure_connections.accept_invite.invite_code',
                                defaultMessage: 'Encrypted invitation code',
                            })}
                            value={inviteCode}
                            onChange={handleInviteCodeChange}
                            data-testid='invite-code'
                        />
                        <Input
                            type='text'
                            name='password'
                            containerClassName='secure-connections-modal-input'
                            placeholder={formatMessage({
                                id: 'admin.secure_connections.accept_invite.password',
                                defaultMessage: 'Password',
                            })}
                            value={password}
                            onChange={handlePasswordChange}
                            data-testid='password'
                        />
                    </ModalFieldset>
                </>
            )}
        </GenericModal>
    );
}

export default SecureConnectionAcceptInviteModal;
