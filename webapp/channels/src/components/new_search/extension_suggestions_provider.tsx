// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ResultsCallback} from 'components/suggestion/provider';
import Provider from 'components/suggestion/provider';

import Constants from 'utils/constants';

import SearchFileExtensionSuggestion from './extension_suggestions';

export type ExtensionItem = {
    label: string;
    type: string;
    value: string;
};

const globalExtensions: ExtensionItem[] = [];
Constants.TEXT_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'text', value: extension}));
Constants.IMAGE_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'image', value: extension}));
Constants.AUDIO_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'audio', value: extension}));
Constants.VIDEO_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'video', value: extension}));
Constants.PRESENTATION_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'presentation', value: extension}));
Constants.SPREADSHEET_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'spreadsheet', value: extension}));
Constants.WORD_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'word', value: extension}));
Constants.CODE_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'code', value: extension}));
Constants.PDF_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'pdf', value: extension}));
Constants.PATCH_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'patch', value: extension}));
Constants.SVG_TYPES.forEach((extension) => globalExtensions.push({label: extension, type: 'svg', value: extension}));
globalExtensions.sort((a, b) => a.label.localeCompare(b.label));

export class SearchFileExtensionProvider extends Provider {
    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<ExtensionItem>) {
        const captured = (/\b(?:ext):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const matchedPretext = captured[1];

            let extensions: ExtensionItem[] = [...globalExtensions];
            if (matchedPretext.length > 0) {
                extensions = extensions.filter((extension) => extension.label.startsWith(matchedPretext.toLowerCase()));
                extensions = extensions.slice(0, 10);
            } else {
                extensions = [
                    {label: 'text', type: 'text', value: 'txt'},
                    {label: 'word', type: 'word', value: 'docx'},
                    {label: 'spreadsheet', type: 'spreadsheet', value: 'xlsx'},
                    {label: 'presentation', type: 'presentation', value: 'pptx'},
                    {label: 'pdf', type: 'pdf', value: 'pdf'},
                    {label: 'image', type: 'image', value: 'png'},
                    {label: 'image', type: 'image', value: 'jpg'},
                    {label: 'audio', type: 'audio', value: 'mp3'},
                    {label: 'video', type: 'video', value: 'mp4'},
                ];
            }

            const terms = extensions.map((extension) => extension.value);

            resultsCallback({
                matchedPretext,
                terms,
                items: extensions,
                component: SearchFileExtensionSuggestion,
            });
        }

        return Boolean(captured);
    }

    allowDividers() {
        return false;
    }

    presentationType() {
        return 'text';
    }
}
