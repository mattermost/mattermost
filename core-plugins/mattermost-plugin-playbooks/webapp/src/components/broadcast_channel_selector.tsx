// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {useIntl} from 'react-intl';

import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIcon from 'src/components/assets/icons/clear_icon';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

interface Props {
    id: string;
    enabled: boolean;
    channelIds: string[];
    onChannelsSelected: (channelIds: string[]) => void;
    teamId: string;
}

const BroadcastChannelSelector = (props: Props) => {
    const {formatMessage} = useIntl();

    return (
        <StyledChannelSelector
            id={props.id}
            onChannelsSelected={props.onChannelsSelected}
            channelIds={props.channelIds}
            isClearable={true}
            selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList, MultiValueRemove}}
            isDisabled={!props.enabled}
            captureMenuScroll={false}
            shouldRenderValue={true}
            placeholder={formatMessage({defaultMessage: 'Select channels'})}
            teamId={props.teamId}
            isMulti={true}
        />
    );
};

const StyledChannelSelector = styled(ChannelSelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .playbooks-rselect__control {
        padding: 4px 16px 4px 3.2rem;

        &::before {
            position: absolute;
            top: 8px;
            left: 16px;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-family: compass-icons, mattermosticons;
            font-size: 18px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }
`;

interface MultiValueRemoveProps {
    innerProps: {
        onClick: () => void;
    }
}

const MultiValueRemove = (props: MultiValueRemoveProps) => (
    <StyledClearIcon
        onClick={(e) => {
            props.innerProps.onClick();
            e.stopPropagation();
        }}
    />
);

const StyledClearIcon = styled(ClearIcon)`
    color: rgba(var(--center-channel-color-rgb), 0.32);
    cursor: pointer;
    font-size: 14px;

    &:hover {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

export default BroadcastChannelSelector;
