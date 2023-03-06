// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {SettingsOutlineIcon} from '@mattermost/compass-icons/components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookWithChecklist} from 'src/types/playbook';
import {PatternedInput} from 'src/components/backstage/playbook_edit/automation/patterned_input';
import {
    AutomationHeader,
    AutomationLabel,
    AutomationTitle,
    SelectorWrapper,
} from 'src/components/backstage/playbook_edit/automation/styles';
import {HorizontalSpacer, RadioInput} from 'src/components/backstage/styles';
import {showPlaybookActionsModal} from 'src/actions';
import {SecondaryButtonLarger} from 'src/components/backstage/playbook_editor/controls';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

type PlaybookSubset = Pick<PlaybookWithChecklist, 'create_public_playbook_run' | 'channel_name_template' | 'delete_at' | 'channel_mode' | 'channel_id'>;

interface Props {
    playbook: PlaybookSubset;
    setPlaybook: React.Dispatch<React.SetStateAction<PlaybookSubset>>;
    setChangesMade?: (b: boolean) => void;
}

export const CreateAChannel = ({playbook, setPlaybook, setChangesMade}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const teamId = useSelector(getCurrentTeamId);
    const archived = playbook.delete_at !== 0;

    const handlePublicChange = (isPublic: boolean) => {
        setPlaybook({
            ...playbook,
            create_public_playbook_run: isPublic,
        });
        setChangesMade?.(true);
    };

    const handleChannelNameTemplateChange = (channelNameTemplate: string) => {
        setPlaybook({
            ...playbook,
            channel_name_template: channelNameTemplate,
        });
        setChangesMade?.(true);
    };

    const handleChannelModeChange = (mode: 'create_new_channel' | 'link_existing_channel') => {
        setPlaybook({
            ...playbook,
            channel_mode: mode,
        });
        setChangesMade?.(true);
    };
    const handleChannelIdChange = (channel_id: string) => {
        setPlaybook({
            ...playbook,
            channel_id,
        });
        setChangesMade?.(true);
    };

    return (
        <Container>
            <AutomationHeader id={'link-existing-channel'}>
                <AutomationTitle
                    css={{alignSelf: 'flex-start'}}
                >
                    <AutomationLabel disabled={archived}>
                        <ChannelModeRadio
                            type='radio'
                            disabled={archived}
                            checked={playbook.channel_mode === 'link_existing_channel'}
                            onChange={() => handleChannelModeChange('link_existing_channel')}
                        />
                        <FormattedMessage defaultMessage='Link to an existing channel'/>
                    </AutomationLabel>
                </AutomationTitle>
                <SelectorWrapper>
                    <StyledChannelSelector
                        id={'link_existing_channel_selector'}
                        onChannelSelected={(channel_id: string) => handleChannelIdChange(channel_id)}
                        channelIds={playbook.channel_id === '' ? [] : [playbook.channel_id]}
                        isClearable={true}
                        selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                        isDisabled={archived || playbook.channel_mode === 'create_new_channel'}
                        captureMenuScroll={false}
                        shouldRenderValue={true}
                        teamId={teamId}
                        isMulti={false}
                    />
                </SelectorWrapper>
            </AutomationHeader>
            <AutomationHeader id={'create-new-channel'}>
                <AutomationTitle css={{alignSelf: 'flex-start'}} >
                    <AutomationLabel disabled={archived}>
                        <ChannelModeRadio
                            type='radio'
                            disabled={archived}
                            checked={playbook.channel_mode === 'create_new_channel'}
                            onChange={() => handleChannelModeChange('create_new_channel')}
                        />
                        <FormattedMessage defaultMessage='Create a run channel'/>
                    </AutomationLabel>
                </AutomationTitle>
                <HorizontalSplit>
                    <VerticalSplit>
                        <ButtonLabel disabled={archived || playbook.channel_mode === 'link_existing_channel'}>
                            <RadioInput
                                type='radio'
                                disabled={archived || playbook.channel_mode === 'link_existing_channel'}
                                checked={playbook.create_public_playbook_run}
                                onChange={() => handlePublicChange(true)}
                            />
                            <Icon
                                disabled={playbook.channel_mode === 'link_existing_channel'}
                                active={playbook.create_public_playbook_run}
                                className={'icon-globe'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Public'})}</BigText>
                        </ButtonLabel>
                        <HorizontalSpacer size={8}/>
                        <ButtonLabel disabled={archived || playbook.channel_mode === 'link_existing_channel'}>
                            <RadioInput
                                type='radio'
                                disabled={archived || playbook.channel_mode === 'link_existing_channel'}
                                checked={!playbook.create_public_playbook_run}
                                onChange={() => handlePublicChange(false)}
                            />
                            <Icon
                                disabled={playbook.channel_mode === 'link_existing_channel'}
                                active={!playbook.create_public_playbook_run}
                                className={'icon-lock-outline'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Private'})}</BigText>
                        </ButtonLabel>
                    </VerticalSplit>
                    <PatternedInput
                        enabled={!archived && playbook.channel_mode === 'create_new_channel'}
                        input={playbook.channel_name_template}
                        onChange={handleChannelNameTemplateChange}
                        pattern={'[\\S][\\s\\S]*[\\S]'} // at least two non-whitespace characters
                        placeholderText={formatMessage({defaultMessage: 'Channel name template (optional)'})}
                        type={'text'}
                        errorText={formatMessage({defaultMessage: 'Channel name is not valid.'})}
                    />
                    <ChannelActionButton
                        disabled={archived || playbook.channel_mode === 'link_existing_channel'}
                        data-testid='playbook-channel-actions-button'
                        onClick={() => dispatch(showPlaybookActionsModal())}
                    >
                        <SettingsOutlineIcon size={16}/>
                        {formatMessage({defaultMessage: 'Configure channel'})}
                    </ChannelActionButton>
                </HorizontalSplit>
            </AutomationHeader>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

export const VerticalSplit = styled.div`
    display: flex;
`;

const HorizontalSplit = styled.div`
    display: block;
    text-align: left;
`;

export const ButtonLabel = styled.label<{disabled: boolean}>`
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: ${({disabled}) => (disabled ? 'rgba(var(--center-channel-color-rgb), 0.04)' : 'var(--center-channel-bg)')};
    border-radius: 4px;
    flex-grow: 1;
    flex-basis: 0;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    cursor: pointer;
`;

const Icon = styled.i<{ active?: boolean, disabled: boolean }>`
    font-size: 16px;
    line-height: 16px;
    color: ${({active, disabled}) => (active && !disabled ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

const BigText = styled.div`
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
`;

const ChannelActionButton = styled(SecondaryButtonLarger)`
    margin-top: 8px;
    height: 40px;
`;

export const StyledChannelSelector = styled(ChannelSelector)`
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

export const ChannelModeRadio = styled(RadioInput)`
    && {
        margin: 0 8px;
    }
`;
