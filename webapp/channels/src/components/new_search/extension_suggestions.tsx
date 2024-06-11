// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import Provider, {ResultsCallback} from 'components/suggestion/provider';
import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';
import type {SuggestionProps} from 'components/suggestion/suggestion';

import {getCompassIconClassName} from 'utils/utils';

import Constants from 'utils/constants';

type ExtensionItem = {
    label: string;
    type: string;
    value: string;
};

export class SearchFileExtensionProvider extends Provider {
    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<ExtensionItem>) {
        const captured = (/\b(?:ext):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const matchedPretext = captured[1];

            let extensions: ExtensionItem[] = [];
            Constants.TEXT_TYPES.forEach((extension) => extensions.push({label: extension, type: 'text', value: extension}))
            Constants.IMAGE_TYPES.forEach((extension) => extensions.push({label: extension, type: 'image', value: extension}))
            Constants.AUDIO_TYPES.forEach((extension) => extensions.push({label: extension, type: 'audio', value: extension}))
            Constants.VIDEO_TYPES.forEach((extension) => extensions.push({label: extension, type: 'video', value: extension}))
            Constants.PRESENTATION_TYPES.forEach((extension) => extensions.push({label: extension, type: 'presentation', value: extension}))
            Constants.SPREADSHEET_TYPES.forEach((extension) => extensions.push({label: extension, type: 'spreadsheet', value: extension}))
            Constants.WORD_TYPES.forEach((extension) => extensions.push({label: extension, type: 'word', value: extension}))
            Constants.CODE_TYPES.forEach((extension) => extensions.push({label: extension, type: 'code', value: extension}))
            Constants.PDF_TYPES.forEach((extension) => extensions.push({label: extension, type: 'pdf', value: extension}))
            Constants.PATCH_TYPES.forEach((extension) => extensions.push({label: extension, type: 'patch', value: extension}))
            Constants.SVG_TYPES.forEach((extension) => extensions.push({label: extension, type: 'svg', value: extension}))

            extensions = extensions.filter((extension) => extension.label.startsWith(matchedPretext));
            extensions.sort((a, b) => a.label.localeCompare(b.label));
            extensions = extensions.slice(0, 10);

            const terms = extensions.map((extension) => extension.value);

            resultsCallback({
                matchedPretext,
                terms,
                items: extensions,
                component: SearchDateSuggestion,
            });
        }

        return Boolean(captured);
    }

    allowDividers() {
        return false;
    }

    presentationType() {
        return 'date';
    }
}

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
        margin-right: 8px;
        display: flex;
        align-items: center;
    }
`;

export const SearchFileExtensionSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<ExtensionItem>>((props, ref) => {
    const {item} = props;

    let labelName: React.ReactNode = item.type;

    switch (item.type) {
        case 'pdf':
            labelName = <FormattedMessage id='file_type.pdf' defaultMessage='Acrobat'/>;
            break;
        case 'word':
            labelName = <FormattedMessage id='file_type.word' defaultMessage='Word Document'/>;
            break;
        case 'image':
            labelName = <FormattedMessage id='file_type.image' defaultMessage='Image'/>;
            break;
        case 'audio':
            labelName = <FormattedMessage id='file_type.audio' defaultMessage='Audio'/>;
            break;
        case 'video':
            labelName = <FormattedMessage id='file_type.video' defaultMessage='Video'/>;
            break;
        case 'presentation':
            labelName = <FormattedMessage id='file_type.presentation' defaultMessage='Powerpoint Presentation'/>;
            break;
        case 'spreadsheet':
            labelName = <FormattedMessage id='file_type.spreadsheet' defaultMessage='Excel spreadsheet'/>;
            break;
        case 'code':
            labelName = <FormattedMessage id='file_type.code' defaultMessage='Code file'/>;
            break;
        case 'patch':
            labelName = <FormattedMessage id='file_type.patch' defaultMessage='Patch file'/>;
            break;
        case 'svg':
            labelName = <FormattedMessage id='file_type.svg' defaultMessage='Vector graphics'/>;
            break;
        case 'text':
            labelName = <FormattedMessage id='file_type.text' defaultMessage='Text file'/>;
            break;
    }

    return (
        <SearchFileExtensionSuggestionContainer
            ref={ref}
            className={props.isSelection ? 'selected' : ''}
            onClick={() => props.onClick(item.label, props.matchedPretext)}
        >
             <div className={'file-icon ' + getCompassIconClassName(item.type)}/>
             {labelName}
             <span>(.{item.value})</span>
        </SearchFileExtensionSuggestionContainer>
    );
});
SearchFileExtensionSuggestion.displayName = 'SearcFileExtensionrSuggestion';
