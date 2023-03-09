// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useState} from 'react';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import Dropdown from 'src/components/dropdown';
import {CancelSaveButtons} from 'src/components/checklist_item/inputs';

type Props = {
    urls: string[];
    onChange: (urls: string[]) => Promise<any>;
    errorText?: string;
    rows?: number;
    maxRows?: number;
    maxErrorText?: string;
    maxLength?: number;
    children?: ReactNode;
    webhooksDisabled: boolean;
}

export const WebhooksInput = (props: Props) => {
    const {formatMessage} = useIntl();
    const [invalid, setInvalid] = useState<boolean>(false);
    const [errorText, setErrorText] = useState<string>(props.errorText || formatMessage({defaultMessage: 'Invalid webhook URLs'}));
    const [urls, setURLs] = useState<string[]>(props.urls);

    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const onChange = async (newURLs: string) => {
        setURLs(newURLs.split('\n'));
    };

    const target = (
        <div
            onClick={toggleOpen}
        >
            {props.children}
        </div>
    );

    const errorTextTemp = props.errorText || formatMessage({defaultMessage: 'Invalid webhook URLs'});

    const isValid = (newURLs: string | undefined): boolean => {
        const maxRows = props.maxRows || 64;
        const maxErrorText = props.maxErrorText || formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'});

        if (newURLs && newURLs.split('\n').filter((v) => v.trim().length > 0).length > maxRows) {
            setInvalid(true);
            setErrorText(maxErrorText);
            return false;
        }

        if (newURLs && !isPatternValid(newURLs, 'https?://.*', '\n')) {
            setInvalid(true);
            setErrorText(errorTextTemp);
            return false;
        }

        setInvalid(false);
        return true;
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onOpenChange={setOpen}
            target={target}
            focusManager={{initialFocus: props.webhooksDisabled ? -1 : undefined}}
        >
            <SelectorWrapper>
                <TextArea
                    data-testid={'webhooks-input'}
                    disabled={false}
                    required={true}
                    rows={props.rows || 3}
                    value={urls.join('\n')}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={(e) => isValid(e.target.value)}
                    placeholder={formatMessage({defaultMessage: 'Enter one webhook per line'})}
                    maxLength={props.maxLength || 1000}
                    invalid={invalid}
                    webhooksDisabled={props.webhooksDisabled}
                />
                <ErrorMessage>
                    {errorText}
                </ErrorMessage>
                <CancelSaveButtons
                    onCancel={() => {
                        setOpen(false);
                    }}
                    onSave={() => {
                        const filteredURLs = urls.map((v) => v.trim()).filter((v) => v.length > 0);
                        if (isValid(filteredURLs.join('\n'))) {
                            props.onChange(filteredURLs)
                                .then(() => {
                                    setURLs(filteredURLs);
                                    setOpen(false);
                                })
                                .catch(() => {
                                    setInvalid(true);
                                    setErrorText(errorTextTemp);
                                });
                        }
                    }}
                />
            </SelectorWrapper>
        </Dropdown>
    );
};

export default WebhooksInput;

const isPatternValid = (value: string, pattern: string, delimiter = '\n'): boolean => {
    const regex = new RegExp(pattern);
    const trimmed = value.split(delimiter).filter((v) => v.trim().length);
    const invalid = trimmed.filter((v) => !regex.test(v));
    return invalid.length === 0;
};

const ErrorMessage = styled.div`
    color: var(--error-text);
    margin-left: auto;
    visibility: hidden;
`;

const SelectorWrapper = styled.div`
    margin: 0;
    width: 400px;
    min-height: 40px;
    padding: 16px;

    box-sizing: border-box;
    box-shadow: 0px 20px 32px rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    background: var(--center-channel-bg);
    border: 1px solid var(--center-channel-color-16);
`;

interface TextAreaProps {
    invalid: boolean;
    webhooksDisabled: boolean;
}

const TextArea = styled.textarea<TextAreaProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: auto;
    width: 100%;
    padding: 10px 16px;

    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.24);
    border: none;
    :focus {
        box-shadow: inset 0 0 0 2px rgba(var(--center-channel-color-rgb), 0.32);
    }
    box-sizing: border-box;
    border-radius: 4px;

    font-size: 14px;
    line-height: 20px;
    resize: none;

    ${(props) => props.invalid && props.value && css`
        :not(:focus) {
            box-shadow: inset 0 0 0 2px var(--error-text);
            & + ${ErrorMessage} {
                visibility: visible;
            }
        }
    `}
    ${(props) => props.webhooksDisabled && css`
        :not(:focus):not(:placeholder-shown) {
            text-decoration: line-through;
            color: rgba(var(--center-channel-color-rgb), 0.48);
        }
    `}
`;
