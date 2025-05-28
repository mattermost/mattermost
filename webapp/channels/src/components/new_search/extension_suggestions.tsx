// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl, defineMessages} from 'react-intl';
import styled from 'styled-components';

import type {SuggestionProps} from 'components/suggestion/suggestion';

import {getCompassIconClassName} from 'utils/utils';

import type {ExtensionItem} from './extension_suggestions_provider';

const SearchFileExtensionSuggestionContainer = styled.div`
    display: flex;
    align-items: center;
    padding: 8px 2.4rem;
    &.selected,
    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    .file-icon {
        background-size: 16px 20px;
        width: 24px;
        height: 24px;
        font-size: 18px;
        margin-right: 12px;
        display: flex;
        align-items: center;
        &.icon-file-excel-outline {
            color: #339970;
        }
        &.icon-file-powerpoint-outline {
            color: #e07315;
        }
        &.icon-file-pdf-outline {
            color: #c43133;
        }
        &.icon-file-image-outline,
        &.icon-file-audio-outline,
        &.icon-file-video-outline,
        &.icon-file-word-outline {
            color: #5d89ea;
        }
    }
`;

const ExtensionText = styled.span`
    margin-left: 4px;
`;

const messages: Record<string, MessageDescriptor> =
    defineMessages({
        pdf: {
            id: 'file_type.pdf',
            defaultMessage: 'Acrobat',
        },
        word: {
            id: 'file_type.word',
            defaultMessage: 'Word Document',
        },
        image: {
            id: 'file_type.image',
            defaultMessage: 'Image',
        },
        audio: {
            id: 'file_type.audio',
            defaultMessage: 'Audio',
        },
        video: {
            id: 'file_type.video',
            defaultMessage: 'Video',
        },
        presentation: {
            id: 'file_type.presentation',
            defaultMessage: 'Powerpoint Presentation',
        },
        spreadsheet: {
            id: 'file_type.spreadsheet',
            defaultMessage: 'Excel spreadsheet',
        },
        code: {
            id: 'file_type.code',
            defaultMessage: 'Code file',
        },
        patch: {
            id: 'file_type.patch',
            defaultMessage: 'Patch file',
        },
        svg: {
            id: 'file_type.svg',
            defaultMessage: 'Vector graphics',
        },
        text: {
            id: 'file_type.text',
            defaultMessage: 'Text file',
        },
    });

const SearchFileExtensionSuggestion = React.forwardRef<
HTMLDivElement,
SuggestionProps<ExtensionItem>
>(({item, onClick, matchedPretext, isSelection}, ref) => {
    const intl = useIntl();

    const optionClicked = useCallback(() => {
        onClick(item.value, matchedPretext);
    }, [onClick, item.value, matchedPretext]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            optionClicked();
        }
    }, [optionClicked]);

    const labelName = messages[item.type] ?
        intl.formatMessage(messages[item.type]) :
        item.type;

    const ariaLabel = intl.formatMessage({
        id: 'search_file_extension_suggestion.aria_label',
        defaultMessage: '{fileType} (.{extension})',
    }, {
        fileType: labelName,
        extension: item.value,
    });

    return (
        <SearchFileExtensionSuggestionContainer
            ref={ref}
            className={classNames({selected: isSelection})}
            onClick={optionClicked}
            onKeyDown={handleKeyDown}
            role='button'
            tabIndex={0}
            aria-label={ariaLabel}
        >
            <div className={classNames('file-icon', getCompassIconClassName(item.type))}/>
            {labelName}
            <ExtensionText>{`(.${item.value})`}</ExtensionText>
        </SearchFileExtensionSuggestionContainer>
    );
});
SearchFileExtensionSuggestion.displayName = 'SearchFileExtensionSuggestion';

export default SearchFileExtensionSuggestion;
