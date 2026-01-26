// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TranslateIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {setMyChannelAutotranslationDisabled} from 'mattermost-redux/actions/channels';
import {isChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';

import {openModal} from 'actions/views/modals';

import DisableAutotranslationModal from 'components/disable_autotranslation_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const Autotranslation = ({channel, ...rest}: Props): JSX.Element => {
    const dispatch = useDispatch();

    const config = useSelector((state: GlobalState) => isChannelAutotranslated(state, channel.id));

    const handleAutotranslationToggle = useCallback(() => {
        if (config) {
            // Show confirmation modal when disabling
            dispatch(
                openModal({
                    modalId: ModalIdentifiers.DISABLE_AUTOTRANSLATION_CONFIRM,
                    dialogType: DisableAutotranslationModal,
                    dialogProps: {
                        channel,
                    },
                }),
            );
        } else {
            // Enable directly without confirmation (set disabled = false)
            dispatch(setMyChannelAutotranslationDisabled(channel.id, false));
        }
    }, [channel, config, dispatch]);

    const icon = useMemo(() => <TranslateIcon size='18px'/>, []);

    const labels = useMemo(() => (config ? (
        <FormattedMessage
            id='channel_header.autotranslation.disable'
            defaultMessage='Disable autotranslation'
        />
    ) : (
        <FormattedMessage
            id='channel_header.autotranslation.enable'
            defaultMessage='Enable autotranslation'
        />
    )), [config]);

    return (
        <Menu.Item
            leadingElement={icon}
            id='channelNotificationPreferences'
            onClick={handleAutotranslationToggle}
            labels={labels}
            {...rest}
        />
    );
};

export default React.memo(Autotranslation);
