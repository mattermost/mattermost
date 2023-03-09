import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {clientRunChecklistItemSlashCommand} from 'src/client';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';
import CommandInput from 'src/components/command_input';
import {CallsSlashCommandPrefix} from 'src/constants';
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
            isDisabled={props.disabled}
            onClick={() => {
                if (!props.disabled) {
                    setCommandOpen((open) => !open);
                }
            }}
        >
            <CommandIcon
                title={formatMessage({defaultMessage: 'Command...'})}
                className={'icon-slash-forward icon-12'}
            />
            <CommandTextContainer>
                {formatMessage({defaultMessage: 'Command...'})}
            </CommandTextContainer>
            {props.isEditing && <DropdownArrow className={'icon-chevron-down'}/>}
        </PlaceholderDiv>
    );

    const runButton = (
        <Run
            data-testid={'run'}
            running={running}
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
            {props.command_last_run ? 'Rerun' : 'Run'}
        </Run>
    );

    const commandButton = (
        <CommandText
            onClick={() => {
                if (!props.disabled) {
                    setCommandOpen((open) => !open);
                }
            }}
            isDisabled={props.disabled}
        >
            <TextWithTooltipWhenEllipsis
                id={`checklist-command-button-tooltip-${props.checklistNum}`}
                text={props.command}
                parentRef={commandRef}
            />
            {props.isEditing && <DropdownArrow className={'icon-chevron-down'}/>}
        </CommandText>
    );

    const notEditingCommand = (
        <>
            {!props.disabled && props.playbookRunId !== undefined && runButton}
            {commandButton}
            {!props.disabled && running && <StyledSpinner/>}
        </>
    );

    const editingCommand = (
        <>
            {props.command === '' ? placeholder : commandButton}
        </>
    );

    return (
        <Dropdown
            isOpen={commandOpen}
            onOpenChange={setCommandOpen}
            target={(
                <CommandButton
                    editing={props.isEditing}
                    isDisabled={props.disabled}
                    isPlaceholder={props.command === ''}
                >
                    {(props.isEditing || props.command === '') ? editingCommand : notEditingCommand}
                </CommandButton>
            )}
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

const PlaceholderDiv = styled.div<{isDisabled: boolean}>`
    display: flex;
    align-items: center;
    flex-direction: row;

    ${({isDisabled}) => !isDisabled && css`
        :hover {
            cursor: pointer;
        }
    `}
`;

const CommandButton = styled.div<{editing: boolean, isDisabled: boolean, isPlaceholder: boolean}>`
    display: flex;
    border-radius: 54px;
    padding: 0px 4px;
    height: 24px;
    max-width: 100%;

    background: ${({isPlaceholder}) => (isPlaceholder ? 'transparent' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    border: ${({isPlaceholder}) => (isPlaceholder ? '1px solid rgba(var(--center-channel-color-rgb), 0.08)' : 'none')}; ;
    color: ${({isPlaceholder}) => (isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};

    ${({isDisabled}) => (isDisabled ? css`
        cursor: default;
    ` : css`
        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
            color: var(--center-channel-color);
        }
    `)}
`;

interface RunProps {
    running: boolean;
}

const Run = styled.div<RunProps>`
    font-size: 12px;
    font-weight: bold;
    display: inline;
    color: var(--link-color);
    cursor: pointer;
    margin: 2px 4px 2px 4px;

    &:hover {
        text-decoration: underline;
    }

    ${({running}) => running && css`
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: default;

        &:hover {
            text-decoration: none;
        }
    `}
`;

const CommandText = styled.div<{isDisabled: boolean}>`
    word-break: break-word;
    display: inline;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;

    ${({isDisabled}) => !isDisabled && css`
        :hover {
            cursor: pointer;
        }
    `}
`;

const StyledSpinner = styled(LoadingSpinner)`
    width: 14px;
    height: 14px;
    align-self: center;
    margin: 0 2px;
    position: relative;
    bottom: 1px;
`;

const CommandIcon = styled.i`
    width: 20px;
    height: 20px;
    margin-right: 5px;
    display: flex;
    align-items: center;
    text-align: center;
    flex: table;
    color: rgba(var(--center-channel-color-rgb),0.56);
`;

const CommandTextContainer = styled.div`
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
    margin-right: 4px;
    white-space: nowrap;
`;

export default Command;

const FormContainer = styled.div`
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    box-shadow: 0px 20px 32px rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    min-width: 340px;
    > * {
        margin-bottom: 10px;
    }
`;

const CommandInputContainer = styled.div`
    margin: 16px;
    border-radius: 4px;
    z-index: 3;
`;
