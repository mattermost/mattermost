// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import {
    BellOutlineIcon,
    DockLeftIcon,
    ForumOutlineIcon,
    GlobeIcon,
    PaletteOutlineIcon,
    TuneIcon,
} from '@mattermost/compass-icons/components';
import {defineMessages, useIntl} from 'react-intl';

import {t} from 'utils/i18n';

import {Tab} from 'components/widgets/modals/components/modal_sidebar';

export const holders = defineMessages({
    profile: {
        id: t('user.settings.modal.profile'),
        defaultMessage: 'Profile',
    },
    security: {
        id: t('user.settings.modal.security'),
        defaultMessage: 'Security',
    },
    notifications: {
        id: t('user.settings.modal.notifications'),
        defaultMessage: 'Notifications',
    },
    themes: {
        id: t('user.settings.modal.themes'),
        defaultMessage: 'Themes',
    },
    media: {
        id: t('user.settings.modal.media'),
        defaultMessage: 'Messages & media',
    },
    display: {
        id: t('user.settings.modal.display'),
        defaultMessage: 'Display',
    },
    language: {
        id: t('user.settings.modal.language'),
        defaultMessage: 'Language & time',
    },
    sidebar: {
        id: t('user.settings.modal.sidebar'),
        defaultMessage: 'Sidebar',
    },
    advanced: {
        id: t('user.settings.modal.advanced'),
        defaultMessage: 'Advanced',
    },
    checkEmail: {
        id: 'user.settings.general.checkEmail',
        defaultMessage: 'Check your email at {email} to verify the address. Cannot find the email?',
    },
    confirmTitle: {
        id: t('user.settings.modal.confirmTitle'),
        defaultMessage: 'Discard Changes?',
    },
    confirmMsg: {
        id: t('user.settings.modal.confirmMsg'),
        defaultMessage: 'You have unsaved changes, are you sure you want to discard them?',
    },
    confirmBtns: {
        id: t('user.settings.modal.confirmBtns'),
        defaultMessage: 'Yes, Discard',
    },
});
export function useUserSettingsTabs(): Tab[] {
    const color = 'currentcolor';
    const {formatMessage} = useIntl();
    return [
        {
            icon: (
                <BellOutlineIcon
                    size={18}
                    color={color}
                />),
            name: 'notifications',
            uiName: formatMessage(holders.notifications),
        },
        {
            icon: (
                <PaletteOutlineIcon
                    size={18}
                    color={color}
                />),
            name: 'themes',
            uiName: formatMessage(holders.themes),
        },
        {
            icon: (
                <ForumOutlineIcon
                    size={18}
                    color={color}
                />),
            name: 'media',
            uiName: formatMessage(holders.media),
        },
        {
            icon: (
                <GlobeIcon
                    size={18}
                    color={color}
                />),
            name: 'language',
            uiName: formatMessage(holders.language),
        },
        {
            icon: (
                <DockLeftIcon
                    size={18}
                    color={color}
                />),
            name: 'sidebar',
            uiName: formatMessage(holders.sidebar),
        },
        {
            icon: (
                <TuneIcon
                    size={18}
                    color={color}
                />),
            name: 'advanced',
            uiName: formatMessage(holders.advanced),
        },
    ];
}
