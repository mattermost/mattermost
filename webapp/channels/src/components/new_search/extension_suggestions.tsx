// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl, defineMessages} from 'react-intl';
import styled from 'styled-components';

import type {SuggestionProps} from 'components/suggestion/suggestion';

import {getCompassIconClassName} from 'utils/utils';

import type {ExtensionItem} from './extension_suggestions_provider';

const SearchFileExtensionSuggestionContainer = styled.div`
    display: flex;
    align-items: center;
    padding: 8px 2.4rem;
    &.selected, &:hover {
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
            color: #E07315;
        }
        &.icon-file-pdf-outline {
            color: #C43133;
        }
        &.icon-file-image-outline,&.icon-file-audio-outline, &.icon-file-video-outline, &.icon-file-word-outline {
            color: #5D89EA;
        }
    }
`;

const ExtensionText = styled.span`
    margin-left: 4px;
`;

const messages: Record<string, {id: string; defaultMessage: string}> = defineMessages({
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

const SearchFileExtensionSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<ExtensionItem>>((props, ref) => {
    const intl = useIntl();
    const {item, onClick, matchedPretext, isSelection} = props;

    const optionClicked = useCallback(() => {
        onClick(item.label, matchedPretext);
    }, [onClick, item.label, matchedPretext]);

    let labelName: React.ReactNode = item.type;
    labelName = messages[item.type] ? intl.formatMessage(messages[item.type]) : item.type;

    return (
        <SearchFileExtensionSuggestionContainer
            ref={ref}
            className={isSelection ? 'selected' : ''}
            onClick={optionClicked}
        >
            <div className={'file-icon ' + getCompassIconClassName(item.type)}/>
            {labelName}
            <ExtensionText>{`(.${item.value})`}</ExtensionText>
        </SearchFileExtensionSuggestionContainer>
    );
});
SearchFileExtensionSuggestion.displayName = 'SearchFileExtensionSuggestion';

export default SearchFileExtensionSuggestion;
