// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps, DependencyList} from 'react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {ArchiveOutlineIcon, GlobeIcon, LockIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelWithTeamData} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {searchAllChannels} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import SectionNotice from 'components/section_notice';
import ChannelsInput from 'components/widgets/inputs/channels_input';

import {isArchivedChannel} from 'utils/channel_utils';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import type {SharedChannelsAddResult} from './modal_utils';

import {ModalBody, ModalParagraph} from '../controls';
import {useSharedChannelRemotes} from '../utils';

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
    const [channels, setChannelsInner] = useState<ChannelWithTeamData[]>([]);
    const [errors, setErrors] = useState<{[channel_id: string]: ServerError}>();
    const [done, setDone] = useState(false);

    const setChannels = useCallback((nextChannels: ChannelWithTeamData[] | undefined) => {
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

        const {data} = await dispatch(searchAllChannels(query, {page: 0, per_page: 20, exclude_remote: true, signal}));
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

    const formatLabel: ComponentProps<typeof ChannelsInput<ChannelWithTeamData>>['formatOptionLabel'] = (channel) => {
        return (
            <>
                <ChannelLabel channel={channel}/>
                <SecondaryTextRight className='selected-hidden'>{'~'}{channel.name}</SecondaryTextRight>
                <SecondaryTextRight className='selected-hidden'>{channel.team_display_name}</SecondaryTextRight>
            </>
        );
    };

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
                    formatOptionLabel={formatLabel}
                />
                {errors && Object.entries(errors).map(([id, err]) => {
                    return (
                        <ChannelError
                            key={id}
                            id={id}
                            err={err}
                        />
                    );
                })}
            </ModalBody>
        </GenericModal>
    );
}

const ChannelError = (props: {id: string; err: ServerError}) => {
    const channel = useSelector((state: GlobalState) => getChannel(state, props.id));

    const channelLabel = channel ? (
        <ChannelLabel
            bold={true}
            channel={channel}
        />
    ) : props.id;

    let message = (
        <FormattedMessage
            id='admin.secure_connections.shared_channels.add.error.inviting_remote_to_channel'
            defaultMessage='{channel} could not be added to this connection.'
            values={{channel: channelLabel}}
        />
    );

    if (props.err.server_error_id === 'api.command_share.channel_invite_not_home.error') {
        message = (
            <FormattedMessage
                id='admin.secure_connections.shared_channels.add.error.channel_invite_not_home'
                defaultMessage='{channel} could not be added to this connection because it originates from another connection.'
                values={{channel: channelLabel}}
            />
        );
    }

    return (
        <SectionNotice
            title={message}
            type='danger'
        />
    );
};

const ChannelLabelWrapper = styled.span`
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;

    svg {
        vertical-align: middle;
        margin-left: 6px;
        margin-right: 10px;
    }

    .channels-input__multi-value__label & {
        font-weight: 600;
    }
`;

const ChannelLabel = ({channel, bold}: {channel: Channel; bold?: boolean}) => {
    const ChannelDisplayName = bold ? 'strong' : 'span';

    return (
        <ChannelLabelWrapper>
            <ChannelIcon
                channel={channel}
                size={20}
                color='rgba(var(--center-channel-color-rgb), 0.64)'
            />
            <ChannelDisplayName>{channel?.display_name}</ChannelDisplayName>
        </ChannelLabelWrapper>
    );
};

const ChannelIcon = ({channel, size = 16, ...otherProps}: {channel: Channel} & IconProps) => {
    let Icon = GlobeIcon;

    if (channel?.type === Constants.PRIVATE_CHANNEL) {
        Icon = LockIcon;
    }

    if (isArchivedChannel(channel)) {
        Icon = ArchiveOutlineIcon;
    }

    return (
        <Icon
            size={size}
            {...otherProps}
        />
    );
};

const SecondaryTextRight = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    padding-left: 5px;

    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;

    &:last-child {
        margin-left: auto;
    }
`;

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
