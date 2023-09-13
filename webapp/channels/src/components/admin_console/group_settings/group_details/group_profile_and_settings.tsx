// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import GroupProfile from 'components/admin_console/group_settings/group_details/group_profile';
import LineSwitch from 'components/admin_console/team_channel_settings/line_switch';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {t} from 'utils/i18n';

type GroupSettingsToggleProps = {
    isDefault: boolean;
    allowReference: boolean;
    onToggle: (allowReference: boolean) => void;
    isDisabled?: boolean;
};

const GroupSettingsToggle = ({
    isDefault,
    allowReference,
    onToggle,
    isDisabled,
}: GroupSettingsToggleProps) => (
    <LineSwitch
        id={'allowReferenceSwitch'}
        disabled={isDisabled || isDefault}
        toggled={allowReference}
        last={true}
        onToggle={() => {
            if (isDefault) {
                return;
            }
            onToggle(!allowReference);
        }}
        singleLine={false}
        title={
            <FormattedMessage
                id='admin.team_settings.team_details.groupDetailsToggle'
                defaultMessage='Enable Group Mention (Beta)'
            />
        }
        subTitle={
            <FormattedMarkdownMessage
                id='admin.team_settings.team_details.groupDetailsToggleDescr'
                defaultMessage='When enabled, this group can be mentioned in other channels and teams. This may result in the group member list being visible to all users.'
            />
        }
    />
);

type GroupProfileAndSettingsProps = {
    displayname: string;
    mentionname?: string;
    allowReference: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    onToggle: (allowReference: boolean) => void;
    readOnly?: boolean;
};

export const GroupProfileAndSettings = ({
    displayname,
    mentionname,
    allowReference,
    onToggle,
    onChange,
    readOnly,
}: GroupProfileAndSettingsProps) => (
    <AdminPanel
        id='group_profile'
        titleId={t('admin.group_settings.group_detail.groupProfileTitle')}
        titleDefault='Group Profile'
        subtitleId={t(
            'admin.group_settings.group_detail.groupProfileDescription',
        )}
        subtitleDefault='The name for this group.'
    >
        <GroupProfile
            name={displayname}
            title={t('admin.group_settings.group_details.group_profile.name')}
            titleDefault={'Name:'}
            customID={'groupDisplayName'}
            isDisabled={true}
            showAtMention={false}
        />
        <div className='group-settings'>
            <div className='group-settings--body'>
                <div className='section-separator'>
                    <hr className='separator__hr'/>
                </div>
                <GroupSettingsToggle
                    isDefault={false}
                    allowReference={allowReference}
                    onToggle={onToggle}
                    isDisabled={readOnly}
                />
            </div>
        </div>
        {allowReference && (
            <GroupProfile
                name={mentionname}
                title={t(
                    'admin.group_settings.group_details.group_mention.name',
                )}
                titleDefault={'Group Mention:'}
                customID={'groupMention'}
                isDisabled={readOnly}
                showAtMention={true}
                onChange={onChange}
            />
        )}
    </AdminPanel>
);
