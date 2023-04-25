// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import PatternedTextArea from 'src/components/patterned_text_area';

interface Props {
    enabled: boolean;
    disabled?: boolean;
    onToggle: () => void;
    textOnToggle: string;
    placeholderText: string;
    errorText: string;
    input: string;
    pattern: string;
    delimiter?: string;
    onChange?: (updatedInput: string) => void;
    onBlur?: (updatedInput: string) => void;
    maxLength?: number;
    rows?: number;
    maxRows?: number;
    maxErrorText?: string;
}

export const WebhookSetting = (props: Props) => {
    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                    disabled={props.disabled}
                >
                    {props.textOnToggle}
                </Toggle>
            </AutomationTitle>
            <SelectorWrapper>
                <PatternedTextArea
                    {...props}
                    enabled={props.enabled && !props.disabled}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};

