import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import {useUniqueId} from 'src/utils';

import {Textbox as AutocompleteTextbox} from 'src/webapp_globals';

import {BaseInput, InputTrashIcon} from './assets/inputs';

const AutocompleteWrapper = styled.div`
    position: relative;
    flex-grow: 1;
    height: 40px;
    line-height: 40px;

    input {
        padding-right: 30px;
    }

    && {
        input.custom-textarea.custom-textarea {
            transition: all 0.15s ease;
            border: none;
            box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
            height: 40px;
            min-height: 40px;
            &:focus {
                box-shadow: inset 0 0 0 2px var(--button-bg);
                padding: 12px 30px 12px 16px;
            }
        }
    }
`;

interface CommandInputProps {
    command: string;
    setCommand: (command: string) => void;
    autocompleteOnBottom: boolean;
}

const CommandInput = (props: CommandInputProps) => {
    const {formatMessage} = useIntl();

    const [command, setCommand] = useState(props.command);
    const [hover, setHover] = useState(false);
    const textboxRef = useRef(null);
    const id = useUniqueId('step-command-');

    const save = () => {
        // Discard invalid slash commands.
        if (command.trim() === '/' || command.trim() === '') {
            setCommand('');
            props.setCommand('');
        } else {
            props.setCommand(command);
        }
    };
    const shouldShowTrashIcon = command !== '' && command !== '/' && hover;
    return (
        <>
            <AutocompleteWrapper
                onMouseOver={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <AutocompleteTextbox
                    id={id}
                    ref={textboxRef}
                    inputComponent={BaseInput}
                    createMessage={formatMessage({defaultMessage: 'Slash Command'})}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Escape') {
                            if (textboxRef.current) {
                                // @ts-ignore
                                textboxRef.current.blur();
                            }
                        } else if (e.key === 'Enter') {
                            if (e.target) {
                                const input = e.target as HTMLInputElement;
                                setCommand(input.value);
                            }
                        }
                    }}
                    onChange={(e: React.FormEvent<HTMLInputElement>) => {
                        if (e.target) {
                            const input = e.target as HTMLInputElement;
                            setCommand(input.value);
                        }
                    }}
                    suggestionListStyle={props.autocompleteOnBottom ? 'bottom' : 'top'}
                    type='text'
                    value={command}
                    onBlur={save}

                    // the following are required props but aren't used
                    characterLimit={256}
                    onKeyPress={() => true}
                    openWhenEmpty={true}
                />
                <InputTrashIcon show={shouldShowTrashIcon}>
                    <i
                        className='icon-trash-can-outline icon-12 icon--no-spacing mr-1'
                        onClick={() => {
                            setCommand('');
                            props.setCommand('');
                        }}
                    />
                </InputTrashIcon>
            </AutocompleteWrapper>
        </>
    );
};

export default CommandInput;
