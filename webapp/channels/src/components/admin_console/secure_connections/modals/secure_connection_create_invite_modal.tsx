// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon, ContentCopyIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import useCopyText, {messages as copymsg} from 'components/common/hooks/useCopyText';
import LoadingScreen from 'components/loading_screen';
import SectionNotice from 'components/section_notice';
import Input from 'components/widgets/inputs/input/input';

import {Button, ModalFieldset, ModalNoticeWrapper, ModalParagraph} from '../controls';

type Props = {
    creating?: boolean;
    onConfirm: () => Promise<{remoteCluster: RemoteCluster; share: {invite: string; password: string}} | undefined>;
    onCancel?: () => void;
    onExited: () => void;
}

const noop = () => {};

function SecureConnectionCreateInviteModal({
    creating,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();
    const [inviteCode, setInviteCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const {copiedRecently: inviteCopied, onClick: copyInvite} = useCopyText({text: inviteCode});
    const {copiedRecently: passwordCopied, onClick: copyPassword} = useCopyText({text: password});

    useEffect(() => {
        handleConfirm();
    }, []);

    const done = Boolean(inviteCode && password);

    const handleConfirm = async () => {
        if (done) {
            return;
        }

        setLoading(true);

        const result = await onConfirm();
        setLoading(false);

        if (result) {
            const {share} = result;
            setInviteCode(share.invite);
            setPassword(share.password);
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    };

    let title = formatMessage({
        id: 'admin.secure_connections.create_invite.share_title',
        defaultMessage: 'Invitation code',
    });

    if (creating) {
        title = done ? formatMessage({
            id: 'admin.secure_connections.create_invite.create_title_done',
            defaultMessage: 'Connection created',
        }) : formatMessage({
            id: 'admin.secure_connections.create_invite.create_title',
            defaultMessage: 'Create connection',
        });
    }

    const message = (
        <FormattedMessage
            id={'admin.secure_connections.create_invite.share.message'}
            defaultMessage={'Please share the invitation code and password with the administrator of the server you want to connect with.'}
            tagName={ModalParagraph}
        />
    );

    const confirmButtonText = done ? formatMessage({
        id: 'admin.secure_connections.create_invite.confirm.done.button',
        defaultMessage: 'Done',
    }) : formatMessage({
        id: 'admin.secure_connections.create_invite.confirm.save.button',
        defaultMessage: 'Save',
    });

    const notice = done ? (
        <ModalNoticeWrapper>
            <SectionNotice
                title={formatMessage({
                    id: 'admin.secure_connections.create_invite.create_invite.notice.title',
                    defaultMessage: 'Share these two separately to avoid a security compromise',
                })}
                type='warning'
            />
        </ModalNoticeWrapper>
    ) : undefined;

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            isConfirmDisabled={!done}
            handleCancel={onCancel ?? noop}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            autoCloseOnConfirmButton={done}
            backdrop='static'
        >
            {loading ? (
                <LoadingScreen/>
            ) : (
                <>
                    {message}
                    {notice}
                    <ModalFieldset
                        legend={done ? formatMessage({
                            id: 'admin.secure_connections.create_invite.share.label',
                            defaultMessage: 'Share this code and password',
                        }) : undefined}
                    >
                        {inviteCode && (
                            <Input
                                type='text'
                                name='invite-code'
                                containerClassName='secure-connections-modal-input'
                                placeholder={formatMessage({
                                    id: 'admin.secure_connections.create_invite.share.invite_code',
                                    defaultMessage: 'Encrypted invitation code',
                                })}
                                value={inviteCode}
                                data-testid='invite-code'
                                readOnly={true}
                                addon={(
                                    <Button onClick={copyInvite}>
                                        {inviteCopied ? copied : copy}
                                    </Button>
                                )}
                            />
                        )}
                        <Input
                            type='text'
                            name='password'
                            containerClassName='secure-connections-modal-input'
                            placeholder={formatMessage({
                                id: 'admin.secure_connections.create_invite.share.password',
                                defaultMessage: 'Password',
                            })}
                            value={password}
                            onChange={handlePasswordChange}
                            data-testid='password'
                            readOnly={done}
                            addon={done ? (
                                <Button onClick={copyPassword}>
                                    {passwordCopied ? copied : copy}
                                </Button>
                            ) : undefined}

                        />
                    </ModalFieldset>
                </>
            )}
        </GenericModal>
    );
}

const copy = (
    <>
        <ContentCopyIcon size={18}/>
        <FormattedMessage {...copymsg.copy}/>
    </>
);

const copied = (
    <>
        <CheckIcon size={18}/>
        <FormattedMessage {...copymsg.copied}/>
    </>
);

export default SecureConnectionCreateInviteModal;
