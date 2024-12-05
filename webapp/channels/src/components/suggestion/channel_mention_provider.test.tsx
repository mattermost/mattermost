// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getMyChannels: jest.fn(() => []),
    getMyChannelMemberships: jest.fn(() => {}),
}));

jest.mock('stores/redux_store');

import ChannelMentionProvider from './channel_mention_provider';

describe('ChannelMentionProvider.handlePretextChanged', () => {
    const autocompleteChannels = jest.fn();
    const resultsCallback = jest.fn();

    let provider: ChannelMentionProvider;
    beforeEach(() => {
        provider = new ChannelMentionProvider(autocompleteChannels, false);
    });

    describe('basic cases', () => {
        test('should not match empty string', () => {
            const matched = provider.handlePretextChanged('', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });

        test('should not match plain text', () => {
            const matched = provider.handlePretextChanged('this is a test', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });

        test('should match a partial channel\'s name', () => {
            const matched = provider.handlePretextChanged('~town-sq', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('town-sq', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('should match a channel\'s name', () => {
            const matched = provider.handlePretextChanged('~town-square', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('town-square', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('should match a channel\'s partial display name', () => {
            const matched = provider.handlePretextChanged('~Town Sq', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('town sq', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('should match a channel\'s display name', () => {
            const matched = provider.handlePretextChanged('~Town Square', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('town square', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('should match part of the text', () => {
            const matched = provider.handlePretextChanged('this is ~town-squ', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('town-squ', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('should only match at the end of the text', () => {
            const matched = provider.handlePretextChanged('this is ~town-square, not ~off-topic', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('off-topic', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('should lower case search term', () => {
            const matched = provider.handlePretextChanged('this is ~town    SQUARE  ', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('town    square  ', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });
    });

    describe('strikethrough text', () => {
        test('should not match the start of strikethrough text', () => {
            const matched = provider.handlePretextChanged('~~', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });

        test('should not match the middle of strikethrough text', () => {
            const matched = provider.handlePretextChanged('~~town square', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });

        test('should not match the end of strikethrough text', () => {
            const matched = provider.handlePretextChanged('~~this is a test~~', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });
    });

    describe('matching text after completing a result', () => {
        test('should not continue to match a link that was just completed', () => {
            provider.handleCompleteWord('~town-square');

            const matched = provider.handlePretextChanged('This is ~town-square', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });

        test('should not continue to match a link that was completed, even after typing more text', () => {
            provider.handleCompleteWord('~town-square');

            const matched = provider.handlePretextChanged('This is ~town-square and a test', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();
        });

        test('should start matching input again after another link is started', () => {
            provider.handleCompleteWord('~town-square');

            const matched = provider.handlePretextChanged('This is ~town-square and not ~off', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('off', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });
    });

    test('should not continue to match after receiving no results until another possible link starts', () => {
        autocompleteChannels.mockImplementationOnce((prefix, success) => {
            success([]);
        });

        let matched = provider.handlePretextChanged('This is ~no-results', resultsCallback);

        expect(matched).toBe(true);
        expect(autocompleteChannels).toHaveBeenCalledWith('no-results', expect.anything(), expect.anything());
        expect(resultsCallback).toHaveBeenCalledTimes(2);

        autocompleteChannels.mockReset();
        resultsCallback.mockReset();

        matched = provider.handlePretextChanged('This is ~no-results in a test', resultsCallback);

        expect(matched).toBe(false);
        expect(autocompleteChannels).not.toHaveBeenCalled();
        expect(resultsCallback).not.toHaveBeenCalled();

        matched = provider.handlePretextChanged('This is ~no-results in a test using ~town', resultsCallback);

        expect(matched).toBe(true);
        expect(autocompleteChannels).toHaveBeenCalledWith('town', expect.anything(), expect.anything());
        expect(resultsCallback).toHaveBeenCalled();
    });

    describe('delayed autocomplete', () => {
        test('with the setting enabled, should not match a link shorter than the minimum length', () => {
            provider.setProps({delayChannelAutocomplete: true});

            let matched = provider.handlePretextChanged('~', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();

            matched = provider.handlePretextChanged('~t', resultsCallback);

            expect(matched).toBe(false);
            expect(autocompleteChannels).not.toHaveBeenCalled();
            expect(resultsCallback).not.toHaveBeenCalled();

            matched = provider.handlePretextChanged('~to', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('to', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });

        test('with the setting disabled, should match a link shorter than the minimum length', () => {
            provider.setProps({delayChannelAutocomplete: false});

            const matched = provider.handlePretextChanged('~', resultsCallback);

            expect(matched).toBe(true);
            expect(autocompleteChannels).toHaveBeenCalledWith('', expect.anything(), expect.anything());
            expect(resultsCallback).toHaveBeenCalled();
        });
    });
});
