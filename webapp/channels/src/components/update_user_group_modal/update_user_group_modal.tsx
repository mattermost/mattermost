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
import * as Utils from 'utils/utils';

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

const UpdateUserGroupModal = (props: Props) => {
    const [hasUpdated, setHasUpdated] = useState(false);
    const [name, setName] = useState(props.group.display_name);
    const [mention, setMention] = useState(`@${props.group.name}`);
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

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) && isSaveEnabled()) {
            patchGroup();
        }
    }, [name, mention, hasUpdated, saving]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

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
    }, [mention]);

    const updateMentionState = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setHasUpdated(true);
        setMention(value);
        setMentionUpdatedManually(true);
    }, []);

    const goBack = useCallback(() => {
        props.backButtonCallback();
        props.onExited();
    }, [props.backButtonCallback, props.onExited]);

    const patchGroup = useCallback(async () => {
        setSaving(true);
        let newMention = mention;
        const displayName = name;

        if (!displayName || !displayName.trim()) {
            setNameInputErrorText(Utils.localizeMessage('user_groups_modal.nameIsEmpty', 'Name is a required field.'));
            setSaving(false);
            return;
        }

        if (newMention.substring(0, 1) === '@') {
            newMention = newMention.substring(1, newMention.length);
        }

        if (newMention.length < 1) {
            setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionIsEmpty', 'Mention is a required field.'));
            setSaving(false);
            return;
        }

        if (Constants.SPECIAL_MENTIONS.includes(newMention.toLowerCase())) {
            setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionReservedWord', 'Mention contains a reserved word.'));
            setSaving(false);
            return;
        }

        const mentionRegEx = new RegExp(/^[a-z0-9.\-_]+$/);
        if (!mentionRegEx.test(newMention)) {
            setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionInvalidError', 'Invalid character in mention.'));
            setSaving(false);
            return;
        }

        const group: CustomGroupPatch = {
            name: newMention,
            display_name: displayName,
        };
        const data = await props.actions.patchGroup(props.groupId, group);
        if (data?.error) {
            if (data.error?.server_error_id === 'app.custom_group.unique_name') {
                setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionNotUnique', 'Mention needs to be unique.'));
                setSaving(false);
            } else if (data.error?.server_error_id === 'app.group.username_conflict') {
                setMentionInputErrorText(Utils.localizeMessage('user_groups_modal.mentionUsernameConflict', 'A username already exists with this name. Mention must be unique.'));
                setSaving(false);
            } else {
                setShowUnknownError(true);
                setSaving(false);
            }
        } else {
            goBack();
        }
    }, [name, mention, goBack, props.groupId, props.actions.patchGroup]);

    return (
        <Modal
            dialogClassName='a11y__modal user-groups-modal-update'
            show={show}
            onHide={doHide}
            onExited={props.onExited}
            role='dialog'
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
                            placeholder={Utils.localizeMessage('user_groups_modal.name', 'Name')}
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
                            placeholder={Utils.localizeMessage('user_groups_modal.mention', 'Mention')}
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
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                                goBack();
                            }}
                            className='btn btn-tertiary'
                        >
                            {Utils.localizeMessage('multiselect.backButton', 'Back')}
                        </button>
                        <SaveButton
                            id='saveItems'
                            saving={saving}
                            disabled={!isSaveEnabled()}
                            onClick={(e) => {
                                e.preventDefault();
                                patchGroup();
                            }}
                            defaultMessage={Utils.localizeMessage('multiselect.saveDetailsButton', 'Save Details')}
                            savingMessage={Utils.localizeMessage('multiselect.savingDetailsButton', 'Saving...')}
                        />
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default React.memo(UpdateUserGroupModal);
