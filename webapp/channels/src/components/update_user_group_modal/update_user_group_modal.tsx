// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import type {CustomGroupPatch, Group} from '@mattermost/types/groups';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SaveButton from 'components/save_button';
import Input from 'components/widgets/inputs/input/input';

import Constants, {ItemStatus} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {ModalData} from 'types/actions';

import 'components/user_groups_modal/user_groups_modal.scss';
import './update_user_group_modal.scss';

export type Props = {
    onExited: () => void;
    groupId: string;
    group: Group;
    backButtonCallback: () => void;
    actions: {
        patchGroup: (groupId: string, group: CustomGroupPatch) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

const UpdateUserGroupModal = ({
    actions,
    backButtonCallback,
    group,
    groupId,
    onExited,
}: Props) => {
    const [hasUpdated, setHasUpdated] = useState(false);
    const [name, setName] = useState(group.display_name);
    const [mention, setMention] = useState(`@${group.name}`);
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState(true);
    const [mentionInputErrorText, setMentionInputErrorText] = useState('');
    const [nameInputErrorText, setNameInputErrorText] = useState('');
    const [showUnknownError, setShowUnknownError] = useState(false);
    const [mentionUpdatedManually, setMentionUpdatedManually] = useState(false);

    const {formatMessage} = useIntl();

    const doHide = useCallback(() => {
        setShow(false);
    }, []);

    const isSaveEnabled = useCallback(() => {
        return name.length > 0 && mention.length > 0 && hasUpdated && !saving;
    }, [name, mention, hasUpdated, saving]);

    const updateNameState = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        let newMention = mention;
        if (!mentionUpdatedManually) {
            newMention = value.replace(/[^A-Za-z0-9.\-_@]/g, '').toLowerCase();
            if (newMention.substring(0, 1) !== '@') {
                newMention = `@${newMention}`;
            }
        }
        setName(value);
        setHasUpdated(true);
        setMention(newMention);
    }, [mention, mentionUpdatedManually]);

    const updateMentionState = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setHasUpdated(true);
        setMention(value);
        setMentionUpdatedManually(true);
    }, []);

    const goBack = useCallback(() => {
        backButtonCallback();
        onExited();
    }, [backButtonCallback, onExited]);

    const patchGroup = useCallback(async () => {
        setSaving(true);
        let newMention = mention;
        const displayName = name;

        if (!displayName || !displayName.trim()) {
            setNameInputErrorText(formatMessage({id: 'user_groups_modal.nameIsEmpty', defaultMessage: 'Name is a required field.'}));
            setSaving(false);
            return;
        }

        if (newMention.substring(0, 1) === '@') {
            newMention = newMention.substring(1, newMention.length);
        }

        if (newMention.length < 1) {
            setMentionInputErrorText(formatMessage({id: 'user_groups_modal.mentionIsEmpty', defaultMessage: 'Mention is a required field.'}));
            setSaving(false);
            return;
        }

        if (Constants.SPECIAL_MENTIONS.includes(newMention.toLowerCase())) {
            setMentionInputErrorText(formatMessage({id: 'user_groups_modal.mentionReservedWord', defaultMessage: 'Mention contains a reserved word.'}));
            setSaving(false);
            return;
        }

        const mentionRegEx = new RegExp(/^[a-z0-9.\-_]+$/);
        if (!mentionRegEx.test(newMention)) {
            setMentionInputErrorText(formatMessage({id: 'user_groups_modal.mentionInvalidError', defaultMessage: 'Invalid character in mention.'}));
            setSaving(false);
            return;
        }

        const group: CustomGroupPatch = {
            name: newMention,
            display_name: displayName,
        };
        const data = await actions.patchGroup(groupId, group);
        if (data?.error) {
            if (data.error?.server_error_id === 'app.custom_group.unique_name') {
                setMentionInputErrorText(formatMessage({id: 'user_groups_modal.mentionNotUnique', defaultMessage: 'Mention needs to be unique.'}));
                setSaving(false);
            } else if (data.error?.server_error_id === 'app.group.username_conflict') {
                setMentionInputErrorText(formatMessage({id: 'user_groups_modal.mentionUsernameConflict', defaultMessage: 'A username already exists with this name. Mention must be unique.'}));
                setSaving(false);
            } else {
                setShowUnknownError(true);
                setSaving(false);
            }
        } else {
            goBack();
        }
    }, [mention, name, actions, groupId, formatMessage, goBack]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && isSaveEnabled()) {
            patchGroup();
        }
    }, [isSaveEnabled, patchGroup]);

    const onSaveClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>((e) => {
        e.preventDefault();
        patchGroup();
    }, [patchGroup]);

    const onBackClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>((e) => {
        e.preventDefault();
        goBack();
    }, [goBack]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <Modal
            dialogClassName='a11y__modal user-groups-modal-update'
            show={show}
            onHide={doHide}
            onExited={onExited}
            role='none'
            aria-labelledby='createUserGroupsModalLabel'
            id='createUserGroupsModal'
        >
            <Modal.Header closeButton={true}>
                <button
                    type='button'
                    className='modal-header-back-button btn btn-icon'
                    aria-label={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}
                    onClick={goBack}
                >
                    <i className='icon icon-arrow-left'/>
                </button>
                <Modal.Title
                    componentClass='h1'
                    id='updateGroupsModalTitle'
                >
                    <FormattedMessage
                        id='user_groups_modal.editGroupTitle'
                        defaultMessage='Edit Group Details'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body
                className='overflow--visible'
            >
                <div className='user-groups-modal__content'>
                    <div className='group-name-input-wrapper'>
                        <Input
                            type='text'
                            placeholder={formatMessage({id: 'user_groups_modal.name', defaultMessage: 'Name'})}
                            onChange={updateNameState}
                            value={name}
                            data-testid='nameInput'
                            autoFocus={true}
                            customMessage={{type: ItemStatus.ERROR, value: nameInputErrorText}}
                        />
                    </div>
                    <div className='group-mention-input-wrapper'>
                        <Input
                            type='text'
                            placeholder={formatMessage({id: 'user_groups_modal.mention', defaultMessage: 'Mention'})}
                            onChange={updateMentionState}
                            value={mention}
                            data-testid='nameInput'
                            customMessage={{type: ItemStatus.ERROR, value: mentionInputErrorText}}
                        />
                    </div>
                    <div className='update-buttons-wrapper'>
                        {
                            showUnknownError &&
                            <div className='Input___error group-error'>
                                <i className='icon icon-alert-outline'/>
                                <FormattedMessage
                                    id='user_groups_modal.unknownError'
                                    defaultMessage='An unknown error has occurred.'
                                />
                            </div>
                        }
                        <button
                            onClick={onBackClick}
                            className='btn btn-tertiary'
                        >
                            <FormattedMessage
                                id='multiselect.backButton'
                                defaultMessage='Back'
                            />
                        </button>
                        <SaveButton
                            id='saveItems'
                            saving={saving}
                            disabled={!isSaveEnabled()}
                            onClick={onSaveClick}
                            defaultMessage={formatMessage({id: 'multiselect.saveDetailsButton', defaultMessage: 'Save Details'})}
                            savingMessage={formatMessage({id: 'multiselect.savingDetailsButton', defaultMessage: 'Saving...'})}
                        />
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default React.memo(UpdateUserGroupModal);
