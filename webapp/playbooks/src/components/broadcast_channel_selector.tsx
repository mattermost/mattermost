// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
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
    font-size: 14px;
    cursor: pointer;

    :hover {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

export default BroadcastChannelSelector;
