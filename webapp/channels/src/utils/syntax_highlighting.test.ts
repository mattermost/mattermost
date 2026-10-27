// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import hlJS from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import plaintext from 'highlight.js/lib/languages/plaintext';
import swift from 'highlight.js/lib/languages/swift';

import Constants from './constants';
import {getLanguageFromDisplayName, getLanguageName, highlight} from './syntax_highlighting';

jest.mock('highlight.js/lib/core');

describe('utils/syntax_highlighting.tsx', () => {
    it('should register full name language', async () => {
        expect.assertions(1);

        await highlight('swift', '');

        expect(hlJS.registerLanguage).toHaveBeenCalledWith('swift', swift);
    });

    it('should register alias language', async () => {
        expect.assertions(1);

        await highlight('js', '');

        expect(hlJS.registerLanguage).toHaveBeenCalledWith('javascript', javascript);
    });

    it('should register WebVTT format as plaintext', async () => {
        expect.assertions(1);

        await highlight('vtt', '');

        expect(hlJS.registerLanguage).toHaveBeenCalledWith('vtt', plaintext);
    });

    describe('getLanguageFromDisplayName', () => {
        it('should return the language of a displayed name', () => {
            expect(getLanguageFromDisplayName('JavaScript')).toBe('javascript');
            expect(getLanguageFromDisplayName('C#')).toBe('csharp');
        });

        it('should reverse getLanguageName for every highlighted language', () => {
            for (const language of Object.keys(Constants.HighlightedLanguages)) {
                expect(getLanguageFromDisplayName(getLanguageName(language))).toBe(language);
            }
        });

        it('should return an empty string for a name that is not displayed for any language', () => {
            expect(getLanguageFromDisplayName('javascript')).toBe('');
            expect(getLanguageFromDisplayName('Not A Language')).toBe('');
        });
    });
});
