// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TranslateIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {setMyChannelAutotranslation} from 'mattermost-redux/actions/channels';
import {isChannelAutotranslated, isUserLanguageSupportedForAutotranslation} from 'mattermost-redux/selectors/entities/channels';

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

    const isAutotranslated = useSelector((state: GlobalState) => isChannelAutotranslated(state, channel.id));
    const isLanguageSupported = useSelector(isUserLanguageSupportedForAutotranslation);

    const handleAutotranslationToggle = useCallback(() => {
        if (!isLanguageSupported) {
            return;
        }
        if (isAutotranslated) {
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
            // Enable directly without confirmation
            dispatch(setMyChannelAutotranslation(channel.id, true));
        }
    }, [channel, isAutotranslated, isLanguageSupported, dispatch]);

    const icon = useMemo(() => <TranslateIcon size='18px'/>, []);

    const labels = useMemo(() => {
        if (!isLanguageSupported) {
            return (
                <>
                    <FormattedMessage
                        id='channel_header.autotranslation.language_not_supported.title'
                        defaultMessage='Auto-translation'
                    />
                    <FormattedMessage
                        id='channel_header.autotranslation.language_not_supported.subtitle'
                        defaultMessage='Your language is not supported'
                    />
                </>
            );
        }
        if (isAutotranslated) {
            return (
                <FormattedMessage
                    id='channel_header.autotranslation.disable'
                    defaultMessage='Disable autotranslation'
                />
            );
        }
        return (
            <FormattedMessage
                id='channel_header.autotranslation.enable'
                defaultMessage='Enable autotranslation'
            />
        );
    }, [isAutotranslated, isLanguageSupported]);

    return (
        <Menu.Item
            leadingElement={icon}
            id='channelNotificationPreferences'
            onClick={handleAutotranslationToggle}
            labels={labels}
            disabled={!isLanguageSupported}
            {...rest}
        />
    );
};

export default React.memo(Autotranslation);
