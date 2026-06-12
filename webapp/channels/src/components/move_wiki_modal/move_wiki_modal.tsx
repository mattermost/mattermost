// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    wikiTitle: string;
    currentChannelId: string;
    onConfirm: (targetChannelId: string) => void | Promise<void>;
    onCancel?: () => void;
    onExited: () => void;
};

const noop = () => {};

function MoveWikiModal({
    wikiTitle,
    currentChannelId,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [targetChannelId, setTargetChannelId] = useState('');
    const [isMoving, setIsMoving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentTeamId = useSelector(getCurrentTeamId);
    const myChannels = useSelector((state: GlobalState) => getMyChannels(state));

    const eligibleChannels = myChannels.filter((channel: Channel) =>
        channel.team_id === currentTeamId && channel.id !== currentChannelId && channel.delete_at === 0,
    );

    const handleConfirm = useCallback(async () => {
        if (!targetChannelId) {
            return;
        }

        setIsMoving(true);
        setError(null);
        try {
            await onConfirm(targetChannelId);
            dispatch(closeModal(ModalIdentifiers.WIKI_MOVE));
        } catch {
            setIsMoving(false);
            setError(formatMessage({
                id: 'wiki_tab.move_modal_error',
                defaultMessage: 'Failed to move wiki. Please try again.',
            }));
        }
    }, [targetChannelId, onConfirm, dispatch, formatMessage]);

    const title = formatMessage({
        id: 'wiki_tab.move_modal_title',
        defaultMessage: 'Move Wiki to Another Channel',
    });

    const confirmButtonText = formatMessage({
        id: 'wiki_tab.move_modal_confirm',
        defaultMessage: 'Move Wiki',
    });

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={onCancel ?? noop}
            handleConfirm={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isConfirmDisabled={!targetChannelId || isMoving}
            autoCloseOnConfirmButton={false}
        >
            <div>
                <p>
                    {formatMessage({
                        id: 'wiki_tab.move_modal_description',
                        defaultMessage: 'Move "{wikiTitle}" and all its pages to a different channel in this team.',
                    }, {wikiTitle})}
                </p>
                <div className='form-group'>
                    <label htmlFor='target-channel-select'>
                        {formatMessage({
                            id: 'wiki_tab.move_modal_channel_label',
                            defaultMessage: 'Target Channel',
                        })}
                    </label>
                    <select
                        id='target-channel-select'
                        className='form-control'
                        value={targetChannelId}
                        onChange={(e) => setTargetChannelId(e.target.value)}
                        disabled={isMoving}
                    >
                        <option value=''>
                            {formatMessage({
                                id: 'wiki_tab.move_modal_select_channel',
                                defaultMessage: 'Select a channel...',
                            })}
                        </option>
                        {eligibleChannels.map((channel) => (
                            <option
                                key={channel.id}
                                value={channel.id}
                            >
                                {channel.display_name}
                            </option>
                        ))}
                    </select>
                </div>
                {error && (
                    <div
                        className='alert alert-danger'
                        role='alert'
                    >
                        {error}
                    </div>
                )}
            </div>
        </GenericModal>
    );
}

export default MoveWikiModal;
