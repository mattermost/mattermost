// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

import {CategorySorting} from '@mattermost/types/channel_categories';
import {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';
import {FieldsetReactSelect, Option} from 'components/widgets/modals/components/react_select_item';

export const showUnreadsCategoryTitle = {
    id: t('user.settings.sidebar.unread.title'),
    defaultMessage: 'Unread channels',
};

export const dMsTitle = {
    id: t('user.settings.sidebar.direct.title'),
    defaultMessage: 'Direct messages',
};

export const channelsTitle = {
    id: t('user.settings.sidebar.channels.title'),
    defaultMessage: 'Channel categories',
};

export const unreadsInputFieldData: FieldsetCheckbox = {
    title: {
        id: 'user.settings.sidebar.showUnreadsCategoryTitle',
        defaultMessage: 'Group unread channels separately',
    },
    name: 'showUnreadsCategory',
    dataTestId: 'showUnreadsCategoryOn',
};

export const unreradsDescription = {
    id: t('user.settings.sidebar.showUnreadsCategoryDesc'),
    defaultMessage: 'When enabled, all unread channels and direct messages will be grouped together in the sidebar.',
};

export const limits: Option[] = [
    {value: 10000, label: localizeMessage('user.settings.sidebar.limitVisibleGMsDMs.allDirectMessages', 'All Direct Messages')},
    {value: 10, label: '10'},
    {value: 15, label: '15'},
    {value: 20, label: '20'},
    {value: 40, label: '40'},
];

export const dmSortTitle = {
    id: 'user.settings.sidebar.DMsSorting',
    defaultMessage: 'Sort direct messages',
};

export const channelsSortTitle = {
    id: 'user.settings.sidebar.channelsSorting.title',
    defaultMessage: 'Default sort for channel categories',
};

export const channelsSortDesc = {
    id: 'user.settings.sidebar.channelsSorting.desc',
    defaultMessage: 'You can override sorting for individual categories using the category\'s sidebar menu.',
};

export const sortInputFieldData: FieldsetRadio = {
    options: [
        {
            dataTestId: `dmSorting-${CategorySorting.Recency}`,
            title: {
                id: 'user.settings.sidebar.DMsSorting.alphabetically',
                defaultMessage: 'Alphabetically',
            },
            name: `dmSorting-${CategorySorting.Recency}`,
            key: `dmSorting-${CategorySorting.Alphabetical}`,
            value: CategorySorting.Alphabetical,
        },
        {
            dataTestId: `dmSorting-${CategorySorting.Recency}`,
            title: {
                id: 'user.settings.sidebar.DMsSorting.recent',
                defaultMessage: 'By recent activity',
            },
            name: `dmSorting-${CategorySorting.Recency}`,
            key: `dmSorting-${CategorySorting.Recency}`,
            value: CategorySorting.Recency,
        },
    ],
};

export const channelsSortInputFieldData: FieldsetRadio = {
    options: [
        {
            dataTestId: `channelsSorting-${CategorySorting.Recency}`,
            title: {
                id: 'user.settings.sidebar.channelsSorting.alphabetically',
                defaultMessage: 'Alphabetically',
            },
            name: `channelsSorting-${CategorySorting.Alphabetical}`,
            key: `channelsSorting-${CategorySorting.Alphabetical}`,
            value: CategorySorting.Alphabetical,
        },
        {
            dataTestId: `channelsSorting-${CategorySorting.Recency}`,
            title: {
                id: 'user.settings.sidebar.channelsSorting.recent',
                defaultMessage: 'By recent activity',
            },
            name: `channelsSorting-${CategorySorting.Recency}`,
            key: `channelsSorting-${CategorySorting.Recency}`,
            value: CategorySorting.Recency,
        },
        {
            dataTestId: `channelsSorting-${CategorySorting.Manual}`,
            title: {
                id: 'user.settings.sidebar.channelsSorting.manual',
                defaultMessage: 'Manually',
            },
            name: `channelsSorting-${CategorySorting.Manual}`,
            key: `channelsSorting-${CategorySorting.Manual}`,
            value: CategorySorting.Manual,
        },
    ],
};

export const dmLimitInputFieldData: FieldsetReactSelect = {
    options: limits,
};

export const dmLimitTitle = {
    id: 'user.settings.sidebar.limitVisibleGMsDMsTitle',
    defaultMessage: 'Number of direct messages to show in the channel sidebar',
};

export const dmLimitDescription = {
    id: t('user.settings.sidebar.limitVisibleGMsDMsDesc'),
    defaultMessage: 'You can change direct message settings using the direct messages sidebar menu.',
};
