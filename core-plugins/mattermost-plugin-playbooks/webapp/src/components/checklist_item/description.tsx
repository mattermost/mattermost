// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import MarkdownTextbox from 'src/components/markdown_textbox';

import {useUniqueId} from 'src/utils';

import FormattedMarkdown from 'src/components/formatted_markdown';

import {CollapsibleChecklistItemDescription} from './inputs';

interface DescriptionProps {
    value: string;
    onEdit: (value: string) => void;
    editingItem: boolean;
    showDescription: boolean;
    onSave?: () => void;
    onSaveAndAddNew?: () => void;
    title: string;
}

const ChecklistItemDescription = (props: DescriptionProps) => {
    const {formatMessage} = useIntl();
    const placeholder = formatMessage({defaultMessage: 'Add a description (optional)'});
    const id = useUniqueId('editabletext-markdown-textbox');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();

            // Only save and add new if the task has a title, similar to title field behavior
            if (props.title !== '' && props.onSaveAndAddNew) {
                props.onSaveAndAddNew();
            } else if (props.onSave) {
                props.onSave();
            }
        }
    };

    if (props.editingItem) {
        return (
            <ChecklistItemDescriptionContainer>
                <StyledMarkdownTextbox
                    data-testid='checklist-item-textarea-description'
                    id={id}
                    value={props.value}
                    placeholder={placeholder}
                    setValue={props.onEdit}
                    autoFocus={props.value !== ''}
                    hideHelpBar={true}
                    onKeyDown={handleKeyDown}
                />
            </ChecklistItemDescriptionContainer>
        );
    }

    return (
        <CollapsibleChecklistItemDescription expanded={props.showDescription}>
            <RenderedDescription data-testid='rendered-checklist-item-description'>
                {props.value ? (
                    <RenderedDescription>
                        <FormattedMarkdown value={props.value}/>
                    </RenderedDescription>
                ) : (
                    <PlaceholderText>{placeholder}</PlaceholderText>
                )}
            </RenderedDescription>
        </CollapsibleChecklistItemDescription>
    );
};

const PlaceholderText = styled.span`
    opacity: 0.5;
`;

const commonDescriptionStyle = css`
    border-radius: 5px;
    color: var(--center-channel-color-72);
    font-size: 12px;
    line-height: 16px;

    &:hover {
        cursor: text;
    }

    p {
        white-space: pre-wrap;
    }
`;

const RenderedDescription = styled.div`
    ${commonDescriptionStyle}

    p:last-child {
        margin-bottom: 0;
    }
`;

const StyledMarkdownTextbox = styled(MarkdownTextbox)`
    .textarea-wrapper {
        min-height: auto;
    }

    &&& {
        .custom-textarea.custom-textarea {
            ${commonDescriptionStyle}
            display: block;
            resize: none;
            width: 100%;
            padding: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            background: none;

            &:focus {
                box-shadow: none;
            }

            min-height: auto;
        }
    }
`;

const ChecklistItemDescriptionContainer = styled.div`
    padding-right: 8px;
    margin-left: 36px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
`;

export default ChecklistItemDescription;
