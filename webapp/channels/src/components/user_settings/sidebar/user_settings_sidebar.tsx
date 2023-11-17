// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {ValueType} from 'react-select';

import {Preferences} from 'mattermost-redux/constants';

import SectionCreator from 'components/widgets/modals/components/modal_section';

import {CategorySorting, ChannelCategory} from '@mattermost/types/channel_categories';
import {PreferenceType} from '@mattermost/types/preferences';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import CheckboxItemCreator from 'components/widgets/modals/components/checkbox_setting_item';

import RadioItemCreator from 'components/widgets/modals/components/radio_setting_item';
import ReactSelectItemCreator, {Option} from 'components/widgets/modals/components/react_select_item';

import {
    channelsSortDesc,
    channelsSortInputFieldData,
    channelsSortTitle,
    channelsTitle,
    dmLimitDescription,
    dmLimitInputFieldData,
    dmLimitTitle, dmSortTitle,
    dMsTitle, limits,
    showUnreadsCategoryTitle,
    sortInputFieldData,
    unreadsInputFieldData,
    unreradsDescription,
} from './utils';

type Props = {
    currentUserId: string;
    showUnreadsCategory: boolean;
    dmGmLimit: number;
    categories: ChannelCategory[];
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<{data: boolean}>;
    setCategorySorting: (categoryId: string, sorting: CategorySorting) => void;
}

export default function UserSettingsSidebar({showUnreadsCategory, dmGmLimit, categories, currentUserId, savePreferences, setCategorySorting}: Props): JSX.Element {
    const [limit, setLimit] = useState<Limit>({value: 20, label: '20'});
    const [dmSorting, setDmSorting] = useState<string>(CategorySorting.Alphabetical);
    const [channelsSorting, setChannelsSorting] = useState<string>(CategorySorting.Alphabetical);

    const [checked, setChecked] = useState(showUnreadsCategory);
    const [haveChanges, setHaveChanges] = useState(false);

    const setDefaults = useCallback(() => {
        const limitValue = limits.find((l) => l.value === dmGmLimit);
        if (limitValue) {
            setLimit(limitValue);
        }
        const dmSortingValue = categories.find((c) => c.type === 'direct_messages')?.sorting;
        if (dmSortingValue) {
            setDmSorting(dmSortingValue);
        }
        const channelsSortingValue = categories.find((c) => c.type === 'channels')?.sorting;
        if (channelsSortingValue) {
            setChannelsSorting(channelsSortingValue);
        }
        setChecked(showUnreadsCategory);
    }, [categories, dmGmLimit, showUnreadsCategory]);

    useEffect(() => {
        setDefaults();
    }, [setDefaults]);

    function handleChange(selected: ValueType<Option>) {
        if (selected && 'value' in selected) {
            setLimit(selected);
        }
        setHaveChanges(true);
    }

    const handleUnreadsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setChecked(!checked);
        setHaveChanges(true);
    }, [checked]);

    function handleOnChange(e: React.ChangeEvent<HTMLInputElement>) {
        setDmSorting(e.target.value);
        setHaveChanges(true);
    }
    function handleOnChannelsChange(e: React.ChangeEvent<HTMLInputElement>) {
        setChannelsSorting(e.target.value);
        setHaveChanges(true);
    }

    async function handleSubmit() {
        const dmCategory = categories.find((c) => c.type === 'direct_messages')!;
        setCategorySorting(dmCategory.id, dmSorting as CategorySorting);

        const channelsCategory = categories.find((c) => c.type === 'channels')!;
        setCategorySorting(channelsCategory.id, channelsSorting as CategorySorting);

        await savePreferences(currentUserId, [
            {
                user_id: currentUserId,
                category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
                name: Preferences.LIMIT_VISIBLE_DMS_GMS,
                value: limit.value.toString()},
            {
                user_id: currentUserId,
                category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
                name: Preferences.SHOW_UNREAD_SECTION,
                value: checked.toString(),
            },
        ]);
        setHaveChanges(false);
    }

    function handleCancel() {
        setDefaults();
        setHaveChanges(false);
    }

    const dMsContent = (
        <>
            <RadioItemCreator
                title={dmSortTitle}
                inputFieldValue={dmSorting}
                inputFieldData={sortInputFieldData}
                handleChange={handleOnChange}
            />
            <ReactSelectItemCreator
                title={dmLimitTitle}
                description={dmLimitDescription}
                inputFieldValue={limit}
                inputFieldData={dmLimitInputFieldData}
                handleChange={handleChange}
            />
        </>
    );

    const channelsContent = (
        <>
            <RadioItemCreator
                title={channelsSortTitle}
                description={channelsSortDesc}
                inputFieldValue={channelsSorting}
                inputFieldData={channelsSortInputFieldData}
                handleChange={handleOnChannelsChange}
            />
        </>
    );

    const unreadsContent = (
        <CheckboxItemCreator
            description={unreradsDescription}
            inputFieldValue={checked}
            inputFieldData={unreadsInputFieldData}
            handleChange={handleUnreadsChange}
        />
    );

    return (
        <>
            <SectionCreator
                title={showUnreadsCategoryTitle}
                content={unreadsContent}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={channelsTitle}
                content={channelsContent}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={dMsTitle}
                content={dMsContent}
            />
            {haveChanges &&
                <SaveChangesPanel
                    handleSubmit={handleSubmit}
                    handleCancel={handleCancel}
                />
            }
        </>
    );
}
