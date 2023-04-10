// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';
import {trackEvent} from 'actions/telemetry_actions';
import Constants, {TELEMETRY_CATEGORIES} from 'utils/constants';
import {isEnterpriseOrE20License} from 'utils/license_utils';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';
import {GlobalState} from 'types/store';
import {Visibility, WorkTemplate} from '@mattermost/types/work_templates';
import {ChannelType} from '@mattermost/types/channels';

export interface CustomizeProps {
    className?: string;
    name: string;
    visibility: Visibility;
    template: WorkTemplate;

    onNameChanged: (name: string) => void;
    onVisibilityChanged: (visibility: Visibility) => void;
}

const Customize = ({
    name,
    visibility,
    template,
    onNameChanged,
    onVisibilityChanged,
    ...props
}: CustomizeProps) => {
    const {formatMessage} = useIntl();
    const license = useSelector(getLicense);
    const licenseIsEnterprise = isEnterpriseOrE20License(license);
    const templateHasChannels = template.content.findIndex((item) => item.channel) !== -1;
    const templateHasBoards = template.content.findIndex((item) => item.board) !== -1;
    const templateHasPlaybooks = template.content.findIndex((item) => item.playbook) !== -1;
    const canCreatePublicChannel = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.CREATE_PUBLIC_CHANNEL));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.CREATE_PRIVATE_CHANNEL));
    const canCreatePublicPlaybook = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.PLAYBOOK_PUBLIC_CREATE));
    const canCreatePrivatePlaybook = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.PLAYBOOK_PRIVATE_CREATE));

    useEffect(() => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'pageview_customize');
    }, []);

    const privacySelectorValue = (visibility === Visibility.Public ? Constants.OPEN_CHANNEL : Constants.PRIVATE_CHANNEL) as ChannelType;
    const onPrivacySelectorChanged = (value: ChannelType) => {
        onVisibilityChanged(value === Constants.PRIVATE_CHANNEL ? Visibility.Private : Visibility.Public);
    };

    let privateButtonProps = {};
    let publicButtonProps = {};
    if (templateHasPlaybooks) {
        if (!canCreatePublicPlaybook) {
            publicButtonProps = {
                tooltip: formatMessage({id: 'work_templates.customize.public_playbook_permission_issue', defaultMessage: 'You do not have permission to create public playbooks.'}),
                disabled: true,
            };
        }
        if (!canCreatePrivatePlaybook) {
            privateButtonProps = {
                tooltip: formatMessage({id: 'work_templates.customize.private_playbook_permission_issue', defaultMessage: 'You do not have permission to create private playbooks.'}),
                disabled: true,
            };
        }
    }

    if (templateHasChannels) {
        if (!canCreatePublicChannel) {
            publicButtonProps = {
                tooltip: formatMessage({id: 'work_templates.customize.public_channel_permission_issue', defaultMessage: 'You do not have permission to create public channels.'}),
                disabled: true,
            };
        }
        if (!canCreatePrivateChannel) {
            privateButtonProps = {
                tooltip: formatMessage({id: 'work_templates.customize.private_channel_permission_issue', defaultMessage: 'You do not have permission to create private channels.'}),
                disabled: true,
            };
        }
    }

    // leave this rule last as it has priority
    if (templateHasPlaybooks && !licenseIsEnterprise) {
        privateButtonProps = {
            tooltip: formatMessage({id: 'work_templates.customize.private_playbook_license_issue', defaultMessage: 'Private playbooks requires an Enterprise license.'}),
            locked: true,
        };
    }

    let nameFieldLabel;
    if (templateHasChannels && templateHasBoards && templateHasPlaybooks) {
        nameFieldLabel = formatMessage({id: 'work_templates.customize.name_label_all', defaultMessage: 'Name your channel, board, and playbook'});
    } else if (templateHasChannels && templateHasBoards) {
        nameFieldLabel = formatMessage({id: 'work_templates.customize.name_label_channels_boards', defaultMessage: 'Name your channel and board'});
    } else if (templateHasChannels && templateHasPlaybooks) {
        nameFieldLabel = formatMessage({id: 'work_templates.customize.name_label_channels_playbooks', defaultMessage: 'Name your channel and playbook'});
    }

    return (
        <div className={props.className}>
            <div className='name-section-container'>
                <p>
                    <strong>
                        {nameFieldLabel}
                    </strong>
                </p>
                <p className='customize-name-text'>
                    {formatMessage({id: 'work_templates.customize.name_description', defaultMessage: 'This will help you and others find your project items. You can always edit this later.'})}
                </p>
                <input
                    type='text'
                    autoFocus={true}
                    placeholder={formatMessage({id: 'work_templates.customize.name_input_placeholder', defaultMessage: 'e.g. Web app, Growth, Customer Journey etc.'})}
                    value={name}
                    onChange={(e) => onNameChanged(e.target.value)}
                    maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                />
            </div>
            <div className='visibility-section-container'>
                <p>
                    <strong>
                        {formatMessage({id: 'work_templates.customize.visibility_title', defaultMessage: 'Who should have access to this?'})}
                    </strong>
                </p>
                <PublicPrivateSelector
                    selected={privacySelectorValue}
                    onChange={onPrivacySelectorChanged}
                    privateButtonProps={privateButtonProps}
                    publicButtonProps={publicButtonProps}
                />
            </div>
        </div>
    );
};

const StyledCustomized = styled(Customize)`
    display: flex;
    flex-direction: column;
    width: 509px;
    margin: 0 auto;

    .public-private-selector .public-private-selector-button.locked {
        opacity: 1;
    }

    strong {
        font-weight: 600;
        font-size: 14px;
        line-height: 20px;
        color: var(--center-channel-text);
    }

    input {
        padding: 10px 16px;
        font-size: 14px;
        width: 100%;
        border-radius: 4px;
        border: 1px solid rgba(var(--center-channel-text-rgb), 0.16);
        &:focus {
            border: 1px solid var(--button-bg);
            box-shadow: inset 0 0 0 1px var(--button-bg);
        }
    }

    .name-section-container {
        margin-top: 33px;
    }

    .visibility-section-container {
        margin-top: 56px;
    }

    .customize-name-text {
        font-size: 12px;
    }
`;

export default StyledCustomized;
