// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getHaveIChannelBookmarkPermission} from 'components/channel_bookmarks/utils';

import {Constants} from 'utils/constants';

type Props = {
    onSelect: (channelId: string) => Promise<void>;
    onClose: () => void;
    title?: string;
};

const BookmarkChannelSelect = ({
    onSelect,
    onClose,
    title = 'Bookmark in channel',
}: Props) => {
    const intl = useIntl();
    const [selectedChannelId, setSelectedChannelId] = useState('');

    const currentTeamId = useSelector(getCurrentTeamId);
    const myChannels = useSelector(getMyChannels);

    const availableChannels = useSelector((state: GlobalState) => {
        return myChannels.filter((channel) => {
            if (channel.team_id !== currentTeamId) {
                return false;
            }

            if (channel.delete_at !== 0) {
                return false;
            }

            if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
                return false;
            }

            return getHaveIChannelBookmarkPermission(state, channel.id, 'add');
        });
    });

    const sortedChannels = useMemo(() => {
        return [...availableChannels].sort((a, b) => {
            return a.display_name.localeCompare(b.display_name);
        });
    }, [availableChannels]);

    const handleConfirm = useCallback(async () => {
        if (selectedChannelId) {
            await onSelect(selectedChannelId);
            onClose();
        }
    }, [selectedChannelId, onSelect, onClose]);

    const renderChannelOption = (channel: Channel) => {
        const channelName = channel.display_name || channel.name;
        return (
            <option
                key={channel.id}
                value={channel.id}
            >
                {channelName}
            </option>
        );
    };

    return (
        <GenericModal
            className='BookmarkChannelSelect'
            ariaLabel={title}
            modalHeaderText={title}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onClose}
            onExited={onClose}
            confirmButtonText='Bookmark'
            cancelButtonText='Cancel'
            isConfirmDisabled={!selectedChannelId}
            autoCloseOnConfirmButton={false}
        >
            <div style={{padding: '16px 0'}}>
                <label
                    htmlFor='channelSelect'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {'Select a channel'}
                </label>
                <select
                    className='form-control'
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    id='channelSelect'
                >
                    <option value=''>
                        {intl.formatMessage({
                            id: 'channel_select.placeholder',
                            defaultMessage: '--- Select a channel ---',
                        })}
                    </option>
                    {sortedChannels.map(renderChannelOption)}
                </select>
                <small
                    style={{
                        display: 'block',
                        marginTop: '12px',
                        color: 'var(--center-channel-color-64)',
                    }}
                >
                    {'This page will be added as a bookmark in the selected channel'}
                </small>
            </div>
        </GenericModal>
    );
};

export default BookmarkChannelSelect;
