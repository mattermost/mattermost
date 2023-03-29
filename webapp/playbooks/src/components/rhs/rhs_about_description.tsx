// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {useUpdateEffect} from 'react-use';
import {useSelector} from 'react-redux';

import {Team} from '@mattermost/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';

import {useIntl} from 'react-intl';

import PostText from 'src/components/post_text';

interface DescriptionProps {
    value: string;
    onEdit: (value: string) => void;
    editing: boolean;
    setEditing: (editing: boolean) => void;
    readOnly?: boolean;
    onReadOnlyInteract?: () => void;
}

const RHSAboutDescription = (props: DescriptionProps) => {
    const {formatMessage} = useIntl();
    const placeholder = formatMessage({defaultMessage: 'Add a run summary…'});
    const [editedValue, setEditedValue] = useState(props.value);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const saveAndClose = () => {
        const newValue = editedValue.trim();
        setEditedValue(newValue);
        props.onEdit(newValue);
        props.setEditing(false);
    };

    useUpdateEffect(() => {
        setEditedValue(props.value);
    }, [props.value]);

    if (!props.editing) {
        return (

            <RenderedDescription
                data-testid='rendered-description'
                onClick={(event) => {
                    // Enter edit mode only if the user is not clicking a link and there's no selected text
                    // and we are not in read only mode
                    const targetNode = event.target as Node;
                    const selectedText = window.getSelection();
                    const hasSelectedText = selectedText !== null && selectedText.toString() !== '';
                    if (targetNode.nodeName !== 'A' && !hasSelectedText) {
                        if (props.readOnly) {
                            props.onReadOnlyInteract?.();
                            return;
                        }
                        props.setEditing(true);
                    }
                }}
            >
                {editedValue ? (
                    <PostText
                        text={editedValue}
                        team={currentTeam}
                    />
                ) : (
                    <PlaceholderText>{placeholder}</PlaceholderText>
                )}
            </RenderedDescription>
        );
    }

    const computeHeight = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.target.style.height = '5px';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    return (
        <DescriptionTextArea
            data-testid='textarea-description'
            value={editedValue}
            placeholder={placeholder}
            onChange={(e) => setEditedValue(e.target.value)}
            autoFocus={true}
            onFocus={(e) => {
                const val = e.target.value;
                e.target.value = '';
                e.target.value = val;
                computeHeight(e);
            }}
            onBlur={saveAndClose}
            onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    saveAndClose();
                } else if (e.key === 'Escape') {
                    setEditedValue(props.value);
                    props.setEditing(false);
                }
            }}
            onInput={computeHeight}
        />
    );
};

const PlaceholderText = styled.span`
    opacity: 0.5;
`;

const commonDescriptionStyle = css`
    margin-bottom: 16px;
    padding: 2px 8px;

    line-height: 20px;

    border-radius: 5px;

    :hover {
        cursor: text;
    }

    p {
        white-space: pre-wrap;
    }

    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
`;

const RenderedDescription = styled.div`
    ${commonDescriptionStyle}

    p:last-child {
        margin-bottom: 0;
    }
`;

const DescriptionTextArea = styled.textarea`
    ${commonDescriptionStyle} {
    }

    display: block;
    resize: none;
    width: 100%;

    border: none;
    border-radius: 5px;
    box-shadow: none;

    background: rgba(var(--center-channel-color-rgb), 0.04);

    &:focus {
        box-shadow: none;
    }
`;

export default RHSAboutDescription;
