// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SettingItemMin from 'components/setting_item_min';

import Describe from './describe';
import SectionTitle from './section_title';

type Props = {
    ignoreChannelMentions?: string;
    onExpandSection: (section: string) => void;
    globalNotifyLevel?: string;
    memberNotifyLevel: string;
    section: string;
}

export default function CollapseView({onExpandSection, globalNotifyLevel, memberNotifyLevel, section, ignoreChannelMentions}: Props) {
    return (
        <SettingItemMin
            title={<SectionTitle section={section}/>}
            describe={
                <Describe
                    section={section}
                    ignoreChannelMentions={ignoreChannelMentions}
                    memberNotifyLevel={memberNotifyLevel}
                    globalNotifyLevel={globalNotifyLevel}
                    isCollapsed={true}
                />
            }
            updateSection={onExpandSection}
            section={section}
        />
    );
}
