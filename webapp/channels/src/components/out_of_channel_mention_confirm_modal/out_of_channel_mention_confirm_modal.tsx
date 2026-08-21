// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {UserProfile} from '@mattermost/types/users';

import {addChannelMembers} from 'mattermost-redux/actions/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {suppressOutOfChannelEphemeralPost} from 'actions/views/out_of_channel_mention';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import './out_of_channel_mention_confirm_modal.scss';

type Props = {
    addable: UserProfile[];
    notAddable: UserProfile[];
    outOfTeam: UserProfile[];
    channelId: string;
    channelType: string;
    rootId: string;
    isPolicyEnforced: boolean;
    onSend: () => void;
    onExited: () => void;
};

function formatUsersList(users: UserProfile[], teammateNameDisplay: string): string {
    const names = users.map((user) => displayUsername(user, teammateNameDisplay));
    if (names.length === 1) {
        return names[0];
    }
    if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
    }
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function OutOfChannelMentionConfirmModal({
    addable,
    notAddable,
    outOfTeam,
    channelId,
    channelType,
    rootId,
    isPolicyEnforced,
    onSend,
    onExited,
}: Props) {
    const dispatch = useDispatch();
    const teammateNameDisplay = useSelector((state: GlobalState) => getTeammateNameDisplaySetting(state));
    const userId = useSelector(getCurrentUserId);
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [dontAskAgain, setDontAskAgain] = useState(false);

    const persistSkipPreference = useCallback(() => {
        if (!dontAskAgain) {
            return;
        }

        dispatch(savePreferences(userId, [{
            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
            name: Preferences.OUT_OF_CHANNEL_MENTION_SKIP_CONFIRM,
            user_id: userId,
            value: 'true',
        }]));
    }, [dispatch, dontAskAgain, userId]);

    const handleClose = useCallback(() => {
        setDontAskAgain(false);
        setShow(false);
    }, []);

    const handleConfirmSend = useCallback(() => {
        dispatch(suppressOutOfChannelEphemeralPost(channelId, rootId));
        onSend();
    }, [dispatch, channelId, rootId, onSend]);

    const handleSend = useCallback(() => {
        setShow(false);
        persistSkipPreference();
        handleConfirmSend();
    }, [handleConfirmSend, persistSkipPreference]);

    const handleAddAndSend = useCallback(async () => {
        if (addable.length === 0 || saving) {
            return;
        }

        setSaving(true);
        setSubmitError('');

        const result = await dispatch(addChannelMembers(channelId, addable.map((u) => u.id), rootId));
        if (result.error) {
            setSubmitError(result.error.message || '');
            setSaving(false);
            return;
        }

        setShow(false);
        persistSkipPreference();
        handleConfirmSend();
    }, [addable, saving, dispatch, channelId, rootId, handleConfirmSend, persistSkipPreference]);

    const isPrivate = channelType === Constants.PRIVATE_CHANNEL;
    const addableCount = addable.length;
    const unaddableCount = notAddable.length + outOfTeam.length;

    let modalTitle;
    if (addableCount === 0) {
        modalTitle = (
            <FormattedMessage
                id='out_of_channel_mention_confirm_modal.title.fallback'
                defaultMessage="{count, plural, one {Person you mentioned isn't in this channel} other {People you mentioned aren't in this channel}}"
                values={{count: unaddableCount}}
            />
        );
    } else if (isPrivate) {
        modalTitle = (
            <FormattedMessage
                id='out_of_channel_mention_confirm_modal.title.private'
                defaultMessage='{count, plural, one {Add mentioned person to this private channel?} other {Add mentioned people to this private channel?}}'
                values={{count: addableCount}}
            />
        );
    } else {
        modalTitle = (
            <FormattedMessage
                id='out_of_channel_mention_confirm_modal.title.public'
                defaultMessage='{count, plural, one {Add mentioned person to this channel?} other {Add mentioned people to this channel?}}'
                values={{count: addableCount}}
            />
        );
    }

    const footerContent = (
        <>
            <Button
                type='button'
                emphasis='tertiary'
                onClick={handleSend}
                disabled={saving}
            >
                <FormattedMessage
                    id='out_of_channel_mention_confirm_modal.send_without_adding'
                    defaultMessage='Send without adding'
                />
            </Button>
            <Button
                type='button'
                emphasis='primary'
                onClick={handleAddAndSend}
                disabled={saving || addable.length === 0}
            >
                <FormattedMessage
                    id='out_of_channel_mention_confirm_modal.add_and_send'
                    defaultMessage='Add to channel and send'
                />
            </Button>
        </>
    );

    return (
        <GenericModal
            id='outOfChannelMentionConfirmModal'
            className='OutOfChannelMentionConfirmModal a11y__modal'
            show={show}
            onHide={handleClose}
            onExited={onExited}
            compassDesign={true}
            modalHeaderText={modalTitle}
            footerContent={footerContent}
        >
            <div className='OutOfChannelMentionConfirmModal__body'>
                {addable.length > 0 && (
                    <p>
                        <span className='OutOfChannelMentionConfirmModal__mentions'>
                            {formatUsersList(addable, teammateNameDisplay)}
                        </span>
                        {' '}
                        {isPrivate ? (
                            <FormattedMessage
                                id='out_of_channel_mention_confirm_modal.body.private'
                                defaultMessage="{count, plural, one {isn't in this private channel. Add them so they'll be notified. They'll also be able to read all past messages in the channel.} other {aren't in this private channel. Add them so they'll be notified. They'll also be able to read all past messages in the channel.}}"
                                values={{count: addableCount}}
                            />
                        ) : (
                            <FormattedMessage
                                id='out_of_channel_mention_confirm_modal.body.public'
                                defaultMessage="{count, plural, one {isn't in this channel. Add them so they'll be notified.} other {aren't in this channel. Add them so they'll be notified.}}"
                                values={{count: addableCount}}
                            />
                        )}
                    </p>
                )}
                {notAddable.length > 0 && (
                    <p>
                        <span className='OutOfChannelMentionConfirmModal__mentions'>
                            {formatUsersList(notAddable, teammateNameDisplay)}
                        </span>
                        {' '}
                        {isPolicyEnforced ? (
                            <FormattedMessage
                                id='out_of_channel_mention_confirm_modal.not_addable_policy'
                                defaultMessage="{count, plural, one {isn't} other {aren't}} in this channel and won't be notified."
                                values={{count: notAddable.length}}
                            />
                        ) : (
                            <FormattedMessage
                                id='post_body.check_for_out_of_channel_groups_mentions.message'
                                defaultMessage='did not get notified by this mention because they are not in the channel. They cannot be added to the channel because they are not a member of the linked groups. To add them to this channel, they must be added to the linked groups.'
                            />
                        )}
                    </p>
                )}
                {outOfTeam.length > 0 && (
                    <p>
                        <span className='OutOfChannelMentionConfirmModal__mentions'>
                            {formatUsersList(outOfTeam, teammateNameDisplay)}
                        </span>
                        {' '}
                        <FormattedMessage
                            id='out_of_channel_mention_confirm_modal.out_of_team'
                            defaultMessage="{count, plural, one {isn't} other {aren't}} in this channel and won't be notified."
                            values={{count: outOfTeam.length}}
                        />
                        {' '}
                        <FormattedMessage
                            id='out_of_channel_mention_confirm_modal.out_of_team_note'
                            defaultMessage="They are on this server but not on this team, so they can't be added to the channel."
                        />
                    </p>
                )}
                {submitError && (
                    <span
                        id='out-of-channel-mention-modal__invite-error'
                        className='modal__error has-error control-label'
                    >
                        {submitError}
                    </span>
                )}
                <div className='OutOfChannelMentionConfirmModal__checkbox checkbox mb-0'>
                    <label>
                        <input
                            type='checkbox'
                            checked={dontAskAgain}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDontAskAgain(e.target.checked)}
                        />
                        <FormattedMessage
                            id='out_of_channel_mention_confirm_modal.checkbox'
                            defaultMessage="Don't ask me again"
                        />
                    </label>
                </div>
            </div>
        </GenericModal>
    );
}

export default OutOfChannelMentionConfirmModal;
