// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Emoticons from 'utils/emoticons';

describe('Emoticons', () => {
    describe('handleEmoticons', () => {
        // test emoticon patterns
        const emoticonPatterns = {
            slightly_smiling_face: [':)', ':-)'],
            wink: [';)', ';-)'],
            open_mouth: [':o'],
            scream: [':-o'],
            smirk: [':]', ':-]'],
            smile: [':D', ':-D'],
            stuck_out_tongue_closed_eyes: ['x-d'],
            stuck_out_tongue: [':p', ':-p'],
            rage: [':@', ':-@'],
            slightly_frowning_face: [':(', ':-('],
            cry: [':`(', ':\'(', ':’('],
            confused: [':/', ':-/'],
            confounded: [':s', ':-s'],
            neutral_face: [':|', ':-|'],
            flushed: [':$', ':-$'],
            mask: [':-x'],
            heart: ['<3', '&lt;3'],
            broken_heart: ['</3', '&lt;/3'],
        };
        Array.prototype.concat(...Object.values(emoticonPatterns)).forEach((emoticon) => {
            test(`text sequence '${emoticon}' should be recognized as an emoticon`, () => {
                expect(Emoticons.handleEmoticons(emoticon, new Map())).toEqual('$MM_EMOTICON0$');
            });
        });

        // test various uses of emoticons
        test('should replace emoticons with tokens', () => {
            expect(Emoticons.handleEmoticons(':goat: :dash:', new Map())).
                toEqual('$MM_EMOTICON0$ $MM_EMOTICON1$');
        });

        test('should replace emoticons not separated by whitespace', () => {
            expect(Emoticons.handleEmoticons(':goat::dash:', new Map())).
                toEqual('$MM_EMOTICON0$$MM_EMOTICON1$');
        });

        test('should replace emoticons separated by punctuation', () => {
            expect(Emoticons.handleEmoticons('/:goat:..:dash:)', new Map())).
                toEqual('/$MM_EMOTICON0$..$MM_EMOTICON1$)');
        });

        test('should replace emoticons separated by text', () => {
            expect(Emoticons.handleEmoticons('asdf:goat:asdf:dash:asdf', new Map())).
                toEqual('asdf$MM_EMOTICON0$asdf$MM_EMOTICON1$asdf');
        });

        test('shouldn\'t replace invalid emoticons', () => {
            expect(Emoticons.handleEmoticons(':goat : : dash:', new Map())).
                toEqual(':goat : : dash:');
        });

        test('should allow comma immediately following emoticon :)', () => {
            expect(Emoticons.handleEmoticons(':),', new Map())).
                toEqual('$MM_EMOTICON0$,');
        });

        test('should allow comma immediately following emoticon :P', () => {
            expect(Emoticons.handleEmoticons(':P,', new Map())).
                toEqual('$MM_EMOTICON0$,');
        });

        test('should allow punctuation immediately following emoticon :)', () => {
            expect(Emoticons.handleEmoticons(':)!', new Map())).
                toEqual('$MM_EMOTICON0$!');
        });

        test('should allow punctuation immediately following emoticon :P', () => {
            expect(Emoticons.handleEmoticons(':P!', new Map())).
                toEqual('$MM_EMOTICON0$!');
        });

        test('should allow punctuation immediately before and following emoticon :)', () => {
            expect(Emoticons.handleEmoticons('":)"', new Map())).
                toEqual('"$MM_EMOTICON0$"');
        });

        test('should allow punctuation immediately before and following emoticon :P', () => {
            expect(Emoticons.handleEmoticons('":P"', new Map())).
                toEqual('"$MM_EMOTICON0$"');
        });
    });

    describe('matchEmoticons', () => {
        test('empty message', () => {
            expect(Emoticons.matchEmoticons('')).
                toEqual(null);
        });

        test('no emoticons', () => {
            expect(Emoticons.matchEmoticons('test')).
                toEqual(null);
        });

        describe('single', () => {
            test('shorthand forms', () => {
                expect(Emoticons.matchEmoticons(':+1:')).
                    toEqual([':+1:']);
            });

            test('named emoticons forms', () => {
                expect(Emoticons.matchEmoticons(':thumbs_up:')).
                    toEqual([':thumbs_up:']);
            });
        });

        describe('multiple', () => {
            test('shorthand forms', () => {
                expect(Emoticons.matchEmoticons(':+1: :D')).
                    toEqual([':+1:', ':D']);
            });

            test('named emoticons forms', () => {
                expect(Emoticons.matchEmoticons(':thumbs_up: :smile:')).
                    toEqual([':thumbs_up:', ':smile:']);
            });

            test('mixed', () => {
                expect(Emoticons.matchEmoticons(':thumbs_up: :smile: :+1: :D')).
                    toEqual([':thumbs_up:', ':smile:', ':+1:', ':D']);
            });
        });

        test('inline', () => {
            expect(Emoticons.matchEmoticons('I am feeling pretty :D -- you are: ok?')).
                toEqual([':D']);
        });

        test('shouldn\'t render emoticons in code blocks', () => {
            expect(Emoticons.matchEmoticons('`:goat:`')).
                toEqual(null);
        });

        test('shouldn\'t render emoticons in multiline code blocks', () => {
            expect(Emoticons.matchEmoticons('`:goat:` \n `:smile:`')).
                toEqual(null);
        });

        test('shouldn\'t render emoticons in links', () => {
            expect(Emoticons.matchEmoticons('[link](www.google.com/:goat:)')).
                toEqual(null);
        });

        test('shouldn\'t render emoticons in multiline links', () => {
            expect(Emoticons.matchEmoticons('[link](www.google.com/:goat:) \n [link](www.google.com/:smile:)')).
                toEqual(null);
        });
    });
});
