// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it, expect, test, vi} from 'vitest';

import store from 'stores/redux_store';

import {makeInitialState} from 'packages/mattermost-redux/test/test_store';
import EmojiMap from 'utils/emoji_map';
import * as Markdown from 'utils/markdown';
import * as TextFormatting from 'utils/text_formatting';

const emojiMap = new EmojiMap(new Map());

describe('Markdown.Links', () => {
    it('Not links', () => {
        expect(Markdown.format('example.com').trim()).toBe(
            '<p>example.com</p>',
        );

        expect(Markdown.format('readme.md').trim()).toBe(
            '<p>readme.md</p>',
        );

        expect(Markdown.format('@example.com').trim()).toBe(
            '<p>@example.com</p>',
        );

        expect(Markdown.format('./make-compiled-client.sh').trim()).toBe(
            '<p>./make-compiled-client.sh</p>',
        );

        expect(Markdown.format('`https://example.com`').trim()).toBe(
            '<p>' +
                '<span class="codespan__pre-wrap">' +
                    '<code>' +
                        'https://example.com' +
                    '</code>' +
                '</span>' +
            '</p>',
        );

        expect(Markdown.format('[link](example.com').trim()).toBe(
            '<p>[link](example.com</p>',
        );
    });

    it('External links', () => {
        expect(Markdown.format('http://example.com').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a></p>',
        );

        expect(Markdown.format('https://example.com').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></p>',
        );

        expect(Markdown.format('www.example.com').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com" rel="noreferrer" target="_blank">www.example.com</a></p>',
        );

        expect(Markdown.format('www.example.com/index').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/index" rel="noreferrer" target="_blank">www.example.com/index</a></p>',
        );

        expect(Markdown.format('www.example.com/index.html').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/index.html" rel="noreferrer" target="_blank">www.example.com/index.html</a></p>',
        );

        expect(Markdown.format('www.example.com/index/sub').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/index/sub" rel="noreferrer" target="_blank">www.example.com/index/sub</a></p>',
        );

        expect(Markdown.format('www1.example.com').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www1.example.com" rel="noreferrer" target="_blank">www1.example.com</a></p>',
        );

        expect(Markdown.format('example.com/index').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com/index" rel="noreferrer" target="_blank">example.com/index</a></p>',
        );
    });

    it('IP addresses', () => {
        expect(Markdown.format('http://127.0.0.1').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://127.0.0.1" rel="noreferrer" target="_blank">http://127.0.0.1</a></p>',
        );

        expect(Markdown.format('http://192.168.1.1:4040').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://192.168.1.1:4040" rel="noreferrer" target="_blank">http://192.168.1.1:4040</a></p>',
        );

        expect(Markdown.format('http://[::1]:80').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://[::1]:80" rel="noreferrer" target="_blank">http://[::1]:80</a></p>',
        );

        expect(Markdown.format('http://[::1]:8065').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://[::1]:8065" rel="noreferrer" target="_blank">http://[::1]:8065</a></p>',
        );

        expect(Markdown.format('https://[::1]:80').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://[::1]:80" rel="noreferrer" target="_blank">https://[::1]:80</a></p>',
        );

        expect(Markdown.format('http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80" rel="noreferrer" target="_blank">http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80</a></p>',
        );

        expect(Markdown.format('http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:8065').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:8065" rel="noreferrer" target="_blank">http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:8065</a></p>',
        );

        expect(Markdown.format('https://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:443').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:443" rel="noreferrer" target="_blank">https://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:443</a></p>',
        );

        expect(Markdown.format('http://username:password@127.0.0.1').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://username:password@127.0.0.1" rel="noreferrer" target="_blank">http://username:password@127.0.0.1</a></p>',
        );

        expect(Markdown.format('http://username:password@[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://username:password@[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80" rel="noreferrer" target="_blank">http://username:password@[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80</a></p>',
        );
    });

    it('Links with anchors', () => {
        expect(Markdown.format('https://en.wikipedia.org/wiki/URLs#Syntax').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://en.wikipedia.org/wiki/URLs#Syntax" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/URLs#Syntax</a></p>',
        );

        expect(Markdown.format('https://groups.google.com/forum/#!msg').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://groups.google.com/forum/#!msg" rel="noreferrer" target="_blank">https://groups.google.com/forum/#!msg</a></p>',
        );
    });

    it('Email addresses', () => {
        expect(Markdown.format('test@example.com').trim()).toBe(
            '<p><a class="theme" href="mailto:test@example.com" rel="noreferrer" target="_blank">test@example.com</a></p>',
        );
        expect(Markdown.format('test_underscore@example.com').trim()).toBe(
            '<p><a class="theme" href="mailto:test_underscore@example.com" rel="noreferrer" target="_blank">test_underscore@example.com</a></p>',
        );

        expect(Markdown.format('mailto:test@example.com').trim()).toBe(
            '<p><a class="theme markdown__link" href="mailto:test@example.com" rel="noreferrer" target="_blank">mailto:test@example.com</a></p>',
        );
    });

    it('Formatted links', () => {
        expect(Markdown.format('*https://example.com*').trim()).toBe(
            '<p><em><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></em></p>',
        );

        expect(Markdown.format('_https://example.com_').trim()).toBe(
            '<p><em><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></em></p>',
        );

        expect(Markdown.format('**https://example.com**').trim()).toBe(
            '<p><strong><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></strong></p>',
        );

        expect(Markdown.format('__https://example.com__').trim()).toBe(
            '<p><strong><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></strong></p>',
        );

        expect(Markdown.format('***https://example.com***').trim()).toBe(
            '<p><strong><em><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></em></strong></p>',
        );

        expect(Markdown.format('___https://example.com___').trim()).toBe(
            '<p><strong><em><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></em></strong></p>',
        );

        expect(Markdown.format('<https://example.com>').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">https://example.com</a></p>',
        );

        expect(Markdown.format('<https://en.wikipedia.org/wiki/Rendering_(computer_graphics)>').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://en.wikipedia.org/wiki/Rendering_(computer_graphics)" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/Rendering_(computer_graphics)</a></p>',
        );
    });

    it('Links with text', () => {
        expect(Markdown.format('[example link](example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">example link</a></p>',
        );

        expect(Markdown.format('[example.com](example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">example.com</a></p>',
        );

        expect(Markdown.format('[This whole #sentence should be a link](https://example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">This whole #sentence should be a link</a></p>',
        );
    });

    it('Searching for links', () => {
        expect(TextFormatting.formatText('https://en.wikipedia.org/wiki/Unix', {searchTerm: 'wikipedia'}, emojiMap).trim()).toBe(
            '<p><a class="theme markdown__link search-highlight" href="https://en.wikipedia.org/wiki/Unix" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/Unix</a></p>',
        );

        expect(TextFormatting.formatText('[Link](https://en.wikipedia.org/wiki/Unix)', {searchTerm: 'unix'}, emojiMap).trim()).toBe(
            '<p><a class="theme markdown__link search-highlight" href="https://en.wikipedia.org/wiki/Unix" rel="noreferrer" target="_blank">Link</a></p>',
        );
    });

    it('Relative link', () => {
        expect(Markdown.format('[A Relative Link](/static/files/5b4a7904a3e041018526a00dba59ee48.png)').trim()).toBe(
            '<p><a class="theme markdown__link" href="/static/files/5b4a7904a3e041018526a00dba59ee48.png" rel="noreferrer" target="_blank">A Relative Link</a></p>',
        );
    });

    describe('autolinkedUrlSchemes', () => {
        test('only some types of links are rendered when there are custom URL schemes defined', () => {
            vi.spyOn(store, 'getState').mockReturnValue(makeInitialState({
                entities: {
                    general: {
                        config: {
                            CustomUrlSchemes: '',
                        },
                    },
                },
            }));

            // These are always linked
            expect(Markdown.format('http://example.com').trim()).toBe(`<p>${link('http://example.com')}</p>`);

            expect(Markdown.format('https://example.com').trim()).toBe(`<p>${link('https://example.com')}</p>`);

            expect(Markdown.format('ftp://ftp.example.com').trim()).toBe(`<p>${link('ftp://ftp.example.com')}</p>`);

            expect(Markdown.format('tel:1-555-123-4567').trim()).toBe(`<p>${link('tel:1-555-123-4567')}</p>`);

            expect(Markdown.format('mailto:test@example.com').trim()).toBe(`<p>${link('mailto:test@example.com')}</p>`);

            // These aren't linked since they're not configured on the server
            expect(Markdown.format('git://git.example.com').trim()).toBe('<p>git://git.example.com</p>');

            expect(Markdown.format('test:test').trim()).toBe('<p>test:test</p>');
        });

        test('matching links are rendered when schemes are provided', () => {
            vi.spyOn(store, 'getState').mockReturnValue(makeInitialState({
                entities: {
                    general: {
                        config: {
                            CustomUrlSchemes: 'git,test,test.,taco+what,taco.what',
                        },
                    },
                },
            }));

            // These are always linked
            expect(Markdown.format('http://example.com').trim()).toBe(`<p>${link('http://example.com')}</p>`);

            // These are linked since they're configured on the server
            expect(Markdown.format('git://git.example.com').trim()).toBe(`<p>${link('git://git.example.com')}</p>`);

            expect(Markdown.format('test:test').trim()).toBe(`<p>${link('test:test')}</p>`);

            expect(Markdown.format('test.:test').trim()).toBe(`<p>${link('test.:test')}</p>`);

            expect(Markdown.format('taco+what://example.com').trim()).toBe(`<p>${link('taco+what://example.com')}</p>`);

            expect(Markdown.format('taco.what://example.com').trim()).toBe(`<p>${link('taco.what://example.com')}</p>`);
        });

        test('explicit links are not affected by this setting', () => {
            vi.spyOn(store, 'getState').mockReturnValue(makeInitialState({
                entities: {
                    general: {
                        config: {
                            CustomUrlSchemes: '',
                        },
                    },
                },
            }));

            expect(Markdown.format('www.example.com').trim()).toBe(`<p>${link('http://www.example.com', 'www.example.com')}</p>`);

            expect(Markdown.format('[link](git://git.example.com)').trim()).toBe(`<p>${link('git://git.example.com', 'link')}</p>`);

            expect(Markdown.format('<git://git.example.com>').trim()).toBe(`<p>${link('git://git.example.com')}</p>`);
        });
    });
});

function link(href: string, text?: string, title?: string) {
    let out = `<a class="theme markdown__link" href="${href}" rel="noreferrer" target="_blank"`;

    if (title) {
        out += ` title="${title}"`;
    }

    out += `>${text || href}</a>`;

    return out;
}
