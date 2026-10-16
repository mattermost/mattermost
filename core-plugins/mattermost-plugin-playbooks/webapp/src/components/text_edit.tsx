// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {useUpdateEffect} from 'react-use';

import {resolve, useUniqueId} from 'src/utils';

import {CancelSaveButtons, CancelSaveContainer} from './checklist_item/inputs';
import {ButtonIcon} from './assets/buttons';
import Tooltip from './widgets/tooltip';

interface TextEditProps {
    value: string;
    onSave: (value: string) => void;
    children: React.ReactNode | ((edit: () => void) => React.ReactNode);
    placeholder?: string;
    className?: string;
    noBorder?: boolean;
    disabled?: boolean;
    testId?: string;

    editStyles?: ReturnType<typeof css>;
}

const TextEdit = (props: TextEditProps) => {
    const {formatMessage} = useIntl();

    const id = useUniqueId('editabletext-markdown-textbox');
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(props.value);
    const hasAutoFocused = useRef(false);

    useUpdateEffect(() => {
        setValue(props.value);
    }, [props.value]);

    const save = () => {
        setIsEditing(false);
        hasAutoFocused.current = false;
        props.onSave(value);
    };

    const cancel = () => {
        setIsEditing(false);
        hasAutoFocused.current = false;
        setValue(props.value);
    };

    if (isEditing) {
        const editableTestId = props.testId ? props.testId.replace('rendered-', 'textarea-') : 'rendered-editable-text';
        return (
            <Container className={props.className}>
                <EditableTextInput
                    data-testid={editableTestId}
                    value={value}
                    placeholder={props.placeholder}
                    onChange={(e) => {
                        setValue(e.target.value);
                    }}
                    autoFocus={true}
                    disabled={props.disabled}
                    onFocus={(e) => {
                        // Select all text only on initial auto-focus
                        if (!hasAutoFocused.current) {
                            hasAutoFocused.current = true;
                            const target = e.target;
                            setTimeout(() => {
                                target.select();
                            }, 0);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            save();
                        } else if (e.key === 'Escape') {
                            cancel();
                        }
                    }}
                />
                <CancelSaveButtons
                    onCancel={cancel}
                    onSave={save}
                />
            </Container>
        );
    }

    return (
        <Container
            className={props.className}
            data-testid={props.testId || 'rendered-text'}
        >
            {!isEditing && !props.children && (
                <HoverMenuContainer>
                    <Tooltip
                        id={`${id}-tooltip`}
                        shouldUpdatePosition={true}
                        content={formatMessage({defaultMessage: 'Edit'})}
                    >
                        <ButtonIcon
                            data-testid='hover-menu-edit-button'
                            className={'icon-pencil-outline icon-16 btn-icon'}
                            onClick={() => setIsEditing(true)}
                        />
                    </Tooltip>
                </HoverMenuContainer>
            )}
            {resolve(props.children, () => setIsEditing(true)) ?? (
                <RenderedText>
                    {value}
                </RenderedText>
            )}
        </Container>
    );
};

const HoverMenuContainer = styled.div`
    position: absolute;
    z-index: 1;
    top: 8px;
    right: 2px;
    display: flex;
    height: 32px;
    align-items: center;
    padding: 0 8px;
`;

const commonTextStyle = css`
    display: block;
    align-items: center;
    padding: var(--markdown-textbox-padding, 12px 30px 12px 16px);
    border-radius: var(--markdown-textbox-radius, 4px);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;

    &:hover {
        cursor: text;
    }

    p {
        white-space: pre-wrap;
    }
`;

const Container = styled.div`
    position: relative;
    display: flex;
    box-sizing: border-box;
    align-items: center;
    border-radius: var(--markdown-textbox-radius, 4px);

    ${CancelSaveContainer} {
        padding: 8px 0;
    }

    ${HoverMenuContainer} {
        opacity: 0
    }

    &:hover,
    &:focus-within {
        ${HoverMenuContainer} {
            opacity: 1;
        }
    }
`;

const EditableTextInput = styled.input`
    background-color: var(--center-channel-bg);
`;

export const RenderedText = styled.span`
    ${commonTextStyle}

    p:last-child {
        margin-bottom: 0;
    }
`;

export default styled(TextEdit)`
    ${({editStyles}) => editStyles};
`;
