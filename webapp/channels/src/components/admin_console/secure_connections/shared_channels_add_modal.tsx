// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DependencyList} from 'react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {ArchiveOutlineIcon, GlobeIcon, LockIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {searchAllChannels} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import SectionNotice from 'components/section_notice';
import ChannelsInput from 'components/widgets/inputs/channels_input';

import {isArchivedChannel} from 'utils/channel_utils';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import {ModalBody, ModalParagraph} from './controls';
import type {SharedChannelsAddResult} from './utils';
import {useSharedChannelRemotes} from './utils';

type Props = {
    onConfirm: (channels: Channel[]) => Promise<SharedChannelsAddResult>;
    onCancel?: () => void;
    onExited: () => void;
    remoteId: string;
    onHide: () => void;
}

const noop = () => {};

function SharedChannelsAddModal({
    onExited,
    onCancel,
    onConfirm,
    onHide: close,
    remoteId,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [remotesByChannelId] = useSharedChannelRemotes(remoteId);

    const [query, setQuery] = useState('');
    const [channels, setChannelsInner] = useState<Channel[]>([]);
    const [errors, setErrors] = useState<{[channel_id: string]: ServerError}>();
    const [done, setDone] = useState(false);

    const setChannels = useCallback((nextChannels: Channel[] | undefined) => {
        setErrors((errs) => {
            if (!errs || !nextChannels?.length) {
                return undefined;
            }

            // keep any errors for selected channels; discard errors of deselected channels
            return nextChannels.reduce<typeof errors>((nextErrs, {id}) => {
                if (!errs[id]) {
                    return nextErrs;
                }
                return {...nextErrs, [id]: errs[id]};
            }, {});
        });

        setChannelsInner(nextChannels ?? []);
        setDone(false);
    }, []);

    const loadChannels = useLatest(async (signal, query: string) => {
        if (!query) {
            return [];
        }

        const {data} = await dispatch(searchAllChannels(query, {page: 0, per_page: 20, signal}));
        if (data) {
            return data.channels.filter(({id}) => {
                const remote = remotesByChannelId?.[id];

                if (remote && remote.delete_at === 0) {
                    // exclude channels already shared with this remote
                    return false;
                }

                if (remote && remote.delete_at !== 0) {
                    // include channels previously shared with this remote
                    return true;
                }

                // include channels never associated with this remote
                return true;
            });
        }

        return [];
    }, [searchAllChannels, remotesByChannelId], {delay: TYPING_DELAY_MS});

    const handleConfirm = async () => {
        if (done) {
            close();
            return;
        }

        const {errors: errs} = await onConfirm(channels);

        if (Object.keys(errs).length) {
            setErrors(errs);
            setDone(true);
        } else {
            close();
        }
    };

    return (
        <GenericModal
            modalHeaderText={(
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.add.title'
                    defaultMessage='Select channels'
                />
            )}
            confirmButtonText={done ? (
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.add.close.button'
                    defaultMessage='Close'
                />
            ) : (
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.add.confirm.button'
                    defaultMessage='Share'
                />
            )}
            handleCancel={onCancel ?? noop}
            handleConfirm={handleConfirm}
            autoCloseOnConfirmButton={false}
            onExited={onExited}
            compassDesign={true}
            bodyPadding={false}
            bodyOverflowVisible={true}
            isConfirmDisabled={!channels.length}
        >
            <ModalBody>
                <FormattedMessage
                    tagName={ModalParagraph}
                    id={'admin.secure_connections.shared_channels.add.message'}
                    defaultMessage={'Please select a team and channels to share'}
                />

                <ChannelsInput
                    placeholder={
                        <FormattedMessage
                            id='admin.secure_connections.shared_channels.add.input_placeholder'
                            defaultMessage='e.g. {channel_name}'
                            values={{channel_name: Constants.DEFAULT_CHANNEL_UI_NAME}}
                        />
                    }
                    ariaLabel={formatMessage({
                        id: 'admin.secure_connections.shared_channels.add.input_label',
                        defaultMessage: 'Search and add channels',
                    })}
                    channelsLoader={loadChannels}
                    inputValue={query}
                    onInputChange={setQuery}
                    value={channels}
                    onChange={setChannels}
                    autoFocus={true}
                />
                {errors && Object.entries(errors).map(([id]) => {
                    const message = (
                        <FormattedMessage
                            id='admin.secure_connections.shared_channels.add.error_inviting_remote_to_channel'
                            defaultMessage='{channel} could not be added to this connection.'
                            values={{
                                channel: <ChannelLabel channelId={id}/>,
                            }}
                        />
                    );

                    return (
                        <SectionNotice
                            key={id}
                            title={message}
                            type='danger'
                        />
                    );
                })}
            </ModalBody>
        </GenericModal>
    );
}

const ChannelLabelWrapper = styled.span`
    svg {
        vertical-align: middle;
        margin-right: 5px;
    }
`;
export const ChannelLabel = ({channelId}: {channelId: string}) => {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));

    let icon = <GlobeIcon size={16}/>;

    if (channel?.type === Constants.PRIVATE_CHANNEL) {
        icon = <LockIcon size={16}/>;
    }

    if (isArchivedChannel(channel)) {
        icon = <ArchiveOutlineIcon size={16}/>;
    }

    return (
        <ChannelLabelWrapper>
            {icon}
            <strong>{channel?.display_name}</strong>
        </ChannelLabelWrapper>
    );
};

export default SharedChannelsAddModal;

const TYPING_DELAY_MS = 250;

/**
 * Auto-cancels any prior func calls that are still pending
 * @param func cancelable func; the provided signal will be aborted if any subsequent func calls are made
 */
export const useLatest = <TArgs extends unknown[], TResult>(func: (signal: AbortSignal, ...args: TArgs) => Promise<TResult>, deps: DependencyList, opts?: {delay: number}) => {
    const r = useRef<{controller: AbortController; handler?: NodeJS.Timeout}>();

    const start = useCallback(() => {
        r.current = {controller: new AbortController()};
        return r.current;
    }, []);

    const cancel = useCallback(() => {
        if (!r.current) {
            return;
        }
        const {controller: abort, handler} = r.current;
        abort.abort(new DOMException('stale request'));
        if (handler) {
            clearTimeout(handler);
        }

        r.current = undefined;
    }, []);

    useEffect(() => cancel, [cancel]);

    return useCallback(async (...args: TArgs) => {
        cancel();
        const currentRequest = start();

        return new Promise<TResult>((resolve, reject) => {
            currentRequest.handler = setTimeout(async () => {
                func(currentRequest.controller.signal, ...args).then(resolve, reject);
            }, opts?.delay || TYPING_DELAY_MS);
        });
    }, [start, cancel, ...deps]);
};
