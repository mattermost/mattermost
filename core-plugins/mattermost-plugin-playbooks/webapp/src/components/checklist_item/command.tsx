// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {clientRunChecklistItemSlashCommand} from 'src/client';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';
import CommandInput from 'src/components/command_input';
import {CallsSlashCommandPrefix, OVERLAY_DELAY} from 'src/constants';
import {runCallsSlashCommand} from 'src/utils';

import Dropdown from 'src/components/dropdown';

import LoadingSpinner from 'src/components/assets/loading_spinner';
import {useRun, useTimeout} from 'src/hooks';

import {CancelSaveButtons} from './inputs';
import {DropdownArrow} from './assign_to';

interface CommandProps {
    playbookRunId?: string;
    checklistNum: number;
    itemNum: number;

    disabled: boolean;
    command_last_run: number;
    command: string;
    isEditing: boolean;

    onChangeCommand: (newCommand: string) => void;
}

const RunningTimeout = 1000;

const Command = (props: CommandProps) => {
    const {formatMessage} = useIntl();
    const commandRef = useRef(null);
    const [running, setRunning] = useState(false);
    const [command, setCommand] = useState(props.command);
    const dispatch = useDispatch();

    const [playbookRun] = useRun(String(props.playbookRunId));
    const [commandOpen, setCommandOpen] = useState(false);

    // Setting running to true triggers the timeout by setting the delay to RunningTimeout
    useTimeout(() => setRunning(false), running ? RunningTimeout : null);

    const placeholder = (
        <PlaceholderDiv
            $isDisabled={props.disabled}
            onClick={() => {
                if (!props.disabled) {
                    setCommandOpen((open) => !open);
                }
            }}
        >
            <CommandIcon
                className={'icon-slash-forward icon-12'}
            />
            {!props.isEditing && (
                <CommandTextContainer>
                    {formatMessage({defaultMessage: 'Command...'})}
                </CommandTextContainer>
            )}
            {props.isEditing && Boolean(props.command) && <DropdownArrow className={'icon-chevron-down'}/>}
        </PlaceholderDiv>
    );

    const runButton = (
        <Run
            data-testid={'run'}
            $running={running}
            onClick={() => {
                if (!running) {
                    setRunning(true);
                    clientRunChecklistItemSlashCommand(dispatch, props.playbookRunId || '', props.checklistNum, props.itemNum);
                    if (props.command?.startsWith(CallsSlashCommandPrefix) && playbookRun) {
                        runCallsSlashCommand(props.command, playbookRun.channel_id, playbookRun.team_id);
                    }
                }
            }}
        >
            {props.command_last_run ? formatMessage({defaultMessage: 'Rerun'}) : formatMessage({defaultMessage: 'Run'})}
        </Run>
    );

    const commandText = (
        <CommandText
            onClick={() => {
                if (!props.disabled) {
                    setCommandOpen((open) => !open);
                }
            }}
            $isDisabled={props.disabled}
        >
            <TextWithTooltipWhenEllipsis
                id={`checklist-command-button-tooltip-${props.checklistNum}`}
                text={props.command}
                parentRef={commandRef}
            />
            {props.isEditing && Boolean(props.command) && <DropdownArrow className={'icon-chevron-down'}/>}
        </CommandText>
    );

    const notEditingCommand = (
        <>
            {!props.disabled && props.playbookRunId !== undefined && runButton}
            {commandText}
            {!props.disabled && running && <StyledSpinner/>}
        </>
    );

    const editingCommand = (
        <>
            {props.command === '' ? placeholder : commandText}
        </>
    );

    let commandButton = (
        <CommandButton
            data-testid='command-button'
            $editing={props.isEditing}
            $isDisabled={props.disabled}
            $isPlaceholder={props.command === ''}
        >
            {(props.isEditing || props.command === '') ? editingCommand : notEditingCommand}
        </CommandButton>
    );

    const tooltipText = formatMessage({defaultMessage: 'Command'});

    if (props.isEditing && props.command === '') {
        commandButton = (
            <div>
                <OverlayTrigger
                    placement='top'
                    delay={OVERLAY_DELAY}
                    overlay={<Tooltip id='command-tooltip'>{tooltipText}</Tooltip>}
                >
                    {commandButton}
                </OverlayTrigger>
            </div>
        );
    }

    return (
        <Dropdown
            isOpen={commandOpen}
            onOpenChange={setCommandOpen}
            target={commandButton}
        >
            <FormContainer>
                <CommandInputContainer>
                    <CommandInput
                        command={command === '' ? '/' : command}
                        setCommand={setCommand}
                        autocompleteOnBottom={true}
                    />
                </CommandInputContainer>
                <CancelSaveButtons
                    onCancel={() => setCommandOpen(false)}
                    onSave={() => {
                        setCommandOpen(false);
                        props.onChangeCommand(command);
                    }}
                />
            </FormContainer>
        </Dropdown>
    );
};

const PlaceholderDiv = styled.div<{$isDisabled: boolean}>`
    display: flex;
    align-items: center;
    flex-direction: row;

    ${({$isDisabled}) => !$isDisabled && css`
        &:hover {
            cursor: pointer;
        }
    `}
`;

const CommandButton = styled.div<{$editing: boolean, $isDisabled: boolean, $isPlaceholder: boolean}>`
    display: flex;
    border-radius: 54px;
    padding: ${({$isPlaceholder}) => ($isPlaceholder ? '1px' : '1px 4px 1px 6px')};
    height: 24px;
    max-width: 100%;
    background: ${({$isPlaceholder}) => ($isPlaceholder ? 'transparent' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    border: ${({$isPlaceholder}) => ($isPlaceholder ? '1px solid rgba(var(--center-channel-color-rgb), 0.08)' : 'none')}; ;
    color: ${({$isPlaceholder}) => ($isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};

    ${({$isDisabled}) => ($isDisabled ? css`
        cursor: default;
    ` : css`
        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
            color: var(--center-channel-color);
        }
    `)}
`;

interface RunProps {
    $running: boolean;
}

const Run = styled.div<RunProps>`
    font-size: 12px;
    font-weight: bold;
    display: inline;
    color: var(--link-color);
    cursor: pointer;
    margin: 2px 4px;

    &:hover {
        text-decoration: underline;
    }

    ${({$running}) => $running && css`
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: default;

        &:hover {
            text-decoration: none;
        }
    `}
`;

const CommandText = styled.div<{$isDisabled: boolean}>`
    /* stylelint-disable-next-line declaration-property-value-keyword-no-deprecated */
    word-break: break-word;
    display: inline;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;

    ${({$isDisabled}) => !$isDisabled && css`
        &:hover {
            cursor: pointer;
        }
    `}
`;

const StyledSpinner = styled(LoadingSpinner)`
    position: relative;
    bottom: 1px;
    width: 14px;
    height: 14px;
    align-self: center;
    margin: 0 2px;
`;

const CommandIcon = styled.i`
    display: flex;
    width: 20px;
    height: 20px;
    font-size: 14px;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb),0.56);
    text-align: center;
`;

const CommandTextContainer = styled.div`
    margin-right: 4px;
    margin-left: 5px;
    font-size: 12px;
    font-weight: 400;
    line-height: 15px;
    white-space: nowrap;
`;

export default Command;

const FormContainer = styled.div`
    display: flex;
    min-width: 340px;
    box-sizing: border-box;
    flex-direction: column;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 8px;
    background: var(--center-channel-bg);
    box-shadow: 0 20px 32px rgba(0 0 0 / 0.12);

    > * {
        margin-bottom: 10px;
    }
`;

const CommandInputContainer = styled.div`
    z-index: 3;
    border-radius: 4px;
    margin: 16px;
`;
