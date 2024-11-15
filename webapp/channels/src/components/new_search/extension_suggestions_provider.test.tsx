// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SearchFileExtensionProvider} from './extension_suggestions_provider';

describe('components/new_search/SearchFileExtensionProvider', () => {
    test('should not provide any file extensions whenever there is not pretext with ext: in it', () => {
        const provider = new SearchFileExtensionProvider();
        const callback = jest.fn();
        provider.handlePretextChanged('', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    test('should provide a predetermined file extensions whenever there is not pretext', () => {
        const provider = new SearchFileExtensionProvider();
        const callback = jest.fn();
        provider.handlePretextChanged('ext:', callback);
        expect(callback).toHaveBeenCalledWith({
            component: expect.any(Object),
            items: [
                {label: 'text', type: 'text', value: 'txt'},
                {label: 'word', type: 'word', value: 'docx'},
                {label: 'spreadsheet', type: 'spreadsheet', value: 'xlsx'},
                {label: 'presentation', type: 'presentation', value: 'pptx'},
                {label: 'pdf', type: 'pdf', value: 'pdf'},
                {label: 'image', type: 'image', value: 'png'},
                {label: 'image', type: 'image', value: 'jpg'},
                {label: 'audio', type: 'audio', value: 'mp3'},
                {label: 'video', type: 'video', value: 'mp4'},
            ],
            matchedPretext: '',
            terms: ['txt', 'docx', 'xlsx', 'pptx', 'pdf', 'png', 'jpg', 'mp3', 'mp4'],
        });
    });

    test('should provide a filtered set of file extensions whenever there is pretext', () => {
        const provider = new SearchFileExtensionProvider();
        const callback = jest.fn();
        provider.handlePretextChanged('ext:t', callback);
        expect(callback).toHaveBeenCalledWith({
            component: expect.any(Object),
            items: [
                {label: 'tex', type: 'code', value: 'tex'},
                {label: 'thor', type: 'code', value: 'thor'},
                {label: 'tif', type: 'image', value: 'tif'},
                {label: 'tiff', type: 'image', value: 'tiff'},
                {label: 'txt', type: 'text', value: 'txt'},
            ],
            matchedPretext: 't',
            terms: ['tex', 'thor', 'tif', 'tiff', 'txt'],
        });
    });
});
