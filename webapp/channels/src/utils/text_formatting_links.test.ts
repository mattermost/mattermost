// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

    it('Links with parameters', () => {
        expect(Markdown.format('www.example.com/index?params=1').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/index?params=1" rel="noreferrer" target="_blank">www.example.com/index?params=1</a></p>',
        );

        expect(Markdown.format('www.example.com/index?params=1&other=2').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/index?params=1&amp;other=2" rel="noreferrer" target="_blank">www.example.com/index?params=1&amp;other=2</a></p>',
        );

        expect(Markdown.format('www.example.com/index?params=1;other=2').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/index?params=1;other=2" rel="noreferrer" target="_blank">www.example.com/index?params=1;other=2</a></p>',
        );

        expect(Markdown.format('http://example.com:8065').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com:8065" rel="noreferrer" target="_blank">http://example.com:8065</a></p>',
        );

        expect(Markdown.format('http://username:password@example.com').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://username:password@example.com" rel="noreferrer" target="_blank">http://username:password@example.com</a></p>',
        );
    });

    it('Special characters', () => {
        expect(Markdown.format('http://www.example.com/_/page').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/_/page" rel="noreferrer" target="_blank">http://www.example.com/_/page</a></p>',
        );

        expect(Markdown.format('www.example.com/_/page').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://www.example.com/_/page" rel="noreferrer" target="_blank">www.example.com/_/page</a></p>',
        );

        expect(Markdown.format('https://en.wikipedia.org/wiki/🐬').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://en.wikipedia.org/wiki/🐬" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/🐬</a></p>',
        );

        expect(Markdown.format('http://✪df.ws/1234').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://✪df.ws/1234" rel="noreferrer" target="_blank">http://✪df.ws/1234</a></p>',
        );
    });

    it('Brackets', () => {
        expect(Markdown.format('https://en.wikipedia.org/wiki/Rendering_(computer_graphics)').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://en.wikipedia.org/wiki/Rendering_(computer_graphics)" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/Rendering_(computer_graphics)</a></p>',
        );

        expect(Markdown.format('http://example.com/more_(than)_one_(parens)').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com/more_(than)_one_(parens)" rel="noreferrer" target="_blank">http://example.com/more_(than)_one_(parens)</a></p>',
        );

        expect(Markdown.format('http://example.com/(something)?after=parens').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com/(something)?after=parens" rel="noreferrer" target="_blank">http://example.com/(something)?after=parens</a></p>',
        );

        expect(Markdown.format('http://foo.com/unicode_(✪)_in_parens').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://foo.com/unicode_(✪)_in_parens" rel="noreferrer" target="_blank">http://foo.com/unicode_(✪)_in_parens</a></p>',
        );
    });

    it('Links with deeply nested parentheses', () => {
        const godboltUrl =
            "https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:15,lang:c%2B%2B,selection:(endColumn:2,endLineNumber:26),source:'%23include+%3Cmeta%3E'))";
        const escapedUrl = godboltUrl.replace(/'/g, '&#39;');
        const expectedLink =
            '<a class="theme markdown__link" href="' +
            escapedUrl +
            '" rel="noreferrer" target="_blank">' +
            escapedUrl +
            '</a>';

        expect(Markdown.format(godboltUrl).trim()).toBe(
            '<p>' + expectedLink + '</p>',
        );
        expect(Markdown.format('<' + godboltUrl + '>').trim()).toBe(
            '<p>' + expectedLink + '</p>',
        );

        const decodedGodboltUrl =
            "https://godbolt.org/#g:!((g:!((source:'#include+<meta>'))";
        const escapedDecodedUrl = decodedGodboltUrl.
            replace(/'/g, '&#39;').
            replace(/</g, '&lt;').
            replace(/>/g, '&gt;');
        const expectedDecodedLink =
            '<a class="theme markdown__link" href="' +
            escapedDecodedUrl +
            '" rel="noreferrer" target="_blank">' +
            escapedDecodedUrl +
            '</a>';

        expect(Markdown.format(decodedGodboltUrl).trim()).toBe(
            '<p>' + expectedDecodedLink + '</p>',
        );
    });

    it('stops autolink at HTML tags adjacent to host', () => {
        const expected =
            '<a class="theme markdown__link" href="http://www.example.com" rel="noreferrer" target="_blank">www.example.com</a>';

        expect(Markdown.format('www.example.com</b>').trim()).toBe(
            '<p>' + expected + '&lt;/b&gt;</p>',
        );
        expect(Markdown.format('www.example.com<b>bold</b>').trim()).toBe(
            '<p>' + expected + '&lt;b&gt;bold&lt;/b&gt;</p>',
        );
        expect(Markdown.format('We use www2.example.com</b>').trim()).toBe(
            '<p>We use <a class="theme markdown__link" href="http://www2.example.com" rel="noreferrer" target="_blank">www2.example.com</a>&lt;/b&gt;</p>',
        );
    });

    it('keeps angle brackets inside autolinked URL path', () => {
        const url = 'https://godbolt.org/#include+<meta>';
        const escaped = url.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const expected =
            '<a class="theme markdown__link" href="' +
            escaped +
            '" rel="noreferrer" target="_blank">' +
            escaped +
            '</a>';

        expect(Markdown.format(url).trim()).toBe('<p>' + expected + '</p>');
    });

    it('stops autolink at HTML tag after URL path', () => {
        const expected =
            '<a class="theme markdown__link" href="http://www.example.com/path" rel="noreferrer" target="_blank">www.example.com/path</a>';

        expect(Markdown.format('www.example.com/path<b>bold</b>').trim()).toBe(
            '<p>' + expected + '&lt;b&gt;bold&lt;/b&gt;</p>',
        );
    });

    it('stops autolink at self-closing and attributed HTML tags after URL path', () => {
        const expected =
            '<a class="theme markdown__link" href="http://www.example.com/path" rel="noreferrer" target="_blank">www.example.com/path</a>';

        expect(Markdown.format('www.example.com/path<br/>').trim()).toBe(
            '<p>' + expected + '&lt;br/&gt;</p>',
        );
        expect(Markdown.format('www.example.com/path<br />').trim()).toBe(
            '<p>' + expected + '&lt;br /&gt;</p>',
        );
        expect(Markdown.format('www.example.com/path<b class="x">bold</b>').trim()).toBe(
            '<p>' + expected + '&lt;b class=&quot;x&quot;&gt;bold&lt;/b&gt;</p>',
        );
    });

    it('autolinks full godbolt share URL', () => {
        const godboltUrl =
            "https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:15,fontUsePx:'0',j:2,lang:c%2B%2B,selection:(endColumn:2,endLineNumber:26,positionColumn:2,positionLineNumber:26,selectionStartColumn:2,selectionStartLineNumber:26,startColumn:2,startLineNumber:26),source:'%23include+%3Cmeta%3E%0A%23include+%3Cprint%3E%0A%23include+%3Cspan%3E%0A%23include+%3Carray%3E%0Anamespace+meta+%3D+std::meta%3B%0A%0Aenum+ShapeKind+%7B%0A++CIRCLE,%0A++TRIANGLE,%0A++RECTANGLE,%0A%7D%3B%0A%0Atemplate%3Ctypename+E%3E%0Aconstexpr+std::string_view+to_string(E+value)+%7B%0A++template+for+(constexpr+auto+e+:%0A++++++++++++++++std::define_static_array(meta::enumerators_of(%5E%5EE)))%0A++++if+(value+%3D%3D+%5B:e:%5D)%0A++++++return+meta::identifier_of(e)%3B%0A++return+%22%3Cunknown%3E%22%3B%0A%7D%0A%0Aint+main()+%7B%0A++++std::println(%22%7B%7D%22,+to_string(ShapeKind::CIRCLE))%3B%0A++++std::println(%22%7B%7D%22,+to_string(ShapeKind::TRIANGLE))%3B%0A++++std::println(%22%7B%7D%22,+to_string(ShapeKind::RECTANGLE))%3B%0A%7D'),l:'5',n:'0',o:'C%2B%2B+source+%232',t:'0')),header:(),k:50,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((h:executor,i:(argsPanelShown:'1',compilationPanelShown:'0',compiler:g161,compilerName:'',compilerOutShown:'0',execArgs:'',execStdin:'',fontScale:14,fontUsePx:'0',j:1,lang:c%2B%2B,libs:!(),options:'-std%3Dc%2B%2B26+-freflection',overrides:!(),runtimeTools:!(),source:2,stdinPanelShown:'1',wrap:'1'),l:'5',n:'0',o:'Executor+x86-64+gcc+16.1+(C%2B%2B,+Editor+%232)',t:'0')),k:50,l:'4',n:'0',o:'',s:0,t:'0')),l:'2',n:'0',o:'',t:'0')),version:4";
        const html = Markdown.format(godboltUrl).trim();
        const href = html.match(/href="([^"]+)"/)?.[1] ?? '';

        expect(href).toContain('version:4');
        expect(href).toContain('%3Cmeta%3E');
    });

    it('stops autolink at CJK punctuation', () => {
        const expected =
            '<a class="theme markdown__link" href="https://mattermost.com/" rel="noreferrer" target="_blank">https://mattermost.com/</a>';

        expect(
            Markdown.format('https://mattermost.com/，這是第二個網址。').trim(),
        ).toBe('<p>' + expected + '，這是第二個網址。</p>');
    });

    it('does not continue autolink across a blank line', () => {
        const url = 'https://example.com/foo';
        const expected =
            '<a class="theme markdown__link" href="' +
            url +
            '" rel="noreferrer" target="_blank">' +
            url +
            '</a>';

        expect(Markdown.format(url + '\n\nnext paragraph').trim()).toBe(
            '<p>' + expected + '</p>\n<p>next paragraph</p>',
        );
    });

    it('stops autolink at newline before following text', () => {
        const url = 'https://example.com/foo';
        const expected =
            '<a class="theme markdown__link" href="' +
            url +
            '" rel="noreferrer" target="_blank">' +
            url +
            '</a>';

        expect(Markdown.format(url + '\nmore text').trim()).toBe(
            '<p>' + expected + '\nmore text</p>',
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

        expect(Markdown.format('[example.com/other](example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">example.com/other</a></p>',
        );

        expect(Markdown.format('[example.com/other_link](example.com/example)').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com/example" rel="noreferrer" target="_blank">example.com/other_link</a></p>',
        );

        expect(Markdown.format('[link with spaces](example.com/ spaces in the url)').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com/ spaces in the url" rel="noreferrer" target="_blank">link with spaces</a></p>',
        );

        expect(Markdown.format('[This whole #sentence should be a link](https://example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://example.com" rel="noreferrer" target="_blank">This whole #sentence should be a link</a></p>',
        );

        expect(Markdown.format('[email link](mailto:test@example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="mailto:test@example.com" rel="noreferrer" target="_blank">email link</a></p>',
        );

        expect(Markdown.format('[other link](ts3server://example.com)').trim()).toBe(
            '<p><a class="theme markdown__link" href="ts3server://example.com" rel="noreferrer" target="_blank">other link</a></p>',
        );
    });

    it('Links with tooltips', () => {
        expect(Markdown.format('[link](example.com "catch phrase!")').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank" title="catch phrase!">link</a></p>',
        );

        expect(Markdown.format('[link](example.com "title with "quotes"")').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank" title="title with &quot;quotes&quot;">link</a></p>',
        );
        expect(Markdown.format('[link with spaces](example.com/ spaces in the url "and a title")').trim()).toBe(
            '<p><a class="theme markdown__link" href="http://example.com/ spaces in the url" rel="noreferrer" target="_blank" title="and a title">link with spaces</a></p>',
        );
    });

    it('Links with surrounding text', () => {
        expect(Markdown.format('This is a sentence with a http://example.com in it.').trim()).toBe(
            '<p>This is a sentence with a <a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a> in it.</p>',
        );

        expect(Markdown.format('This is a sentence with a http://example.com/_/underscore in it.').trim()).toBe(
            '<p>This is a sentence with a <a class="theme markdown__link" href="http://example.com/_/underscore" rel="noreferrer" target="_blank">http://example.com/_/underscore</a> in it.</p>',
        );

        expect(Markdown.format('This is a sentence with a http://192.168.1.1:4040 in it.').trim()).toBe(
            '<p>This is a sentence with a <a class="theme markdown__link" href="http://192.168.1.1:4040" rel="noreferrer" target="_blank">http://192.168.1.1:4040</a> in it.</p>',
        );

        expect(Markdown.format('This is a sentence with a https://[::1]:80 in it.').trim()).toBe(
            '<p>This is a sentence with a <a class="theme markdown__link" href="https://[::1]:80" rel="noreferrer" target="_blank">https://[::1]:80</a> in it.</p>',
        );
    });

    it('Links with trailing punctuation', () => {
        expect(Markdown.format('This is a link to http://example.com.').trim()).toBe(
            '<p>This is a link to <a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a>.</p>',
        );

        expect(Markdown.format('This is a link containing http://example.com/something?with,commas,in,url, but not at the end').trim()).toBe(
            '<p>This is a link containing <a class="theme markdown__link" href="http://example.com/something?with,commas,in,url" rel="noreferrer" target="_blank">http://example.com/something?with,commas,in,url</a>, but not at the end</p>',
        );

        expect(Markdown.format('This is a question about a link http://example.com?').trim()).toBe(
            '<p>This is a question about a link <a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a>?</p>',
        );
    });

    it('Links with surrounding brackets', () => {
        expect(Markdown.format('(http://example.com)').trim()).toBe(
            '<p>(<a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a>)</p>',
        );

        expect(Markdown.format('(see http://example.com)').trim()).toBe(
            '<p>(see <a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a>)</p>',
        );

        expect(Markdown.format('(http://example.com watch this)').trim()).toBe(
            '<p>(<a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a> watch this)</p>',
        );

        expect(Markdown.format('(www.example.com)').trim()).toBe(
            '<p>(<a class="theme markdown__link" href="http://www.example.com" rel="noreferrer" target="_blank">www.example.com</a>)</p>',
        );

        expect(Markdown.format('(see www.example.com)').trim()).toBe(
            '<p>(see <a class="theme markdown__link" href="http://www.example.com" rel="noreferrer" target="_blank">www.example.com</a>)</p>',
        );

        expect(Markdown.format('(www.example.com watch this)').trim()).toBe(
            '<p>(<a class="theme markdown__link" href="http://www.example.com" rel="noreferrer" target="_blank">www.example.com</a> watch this)</p>',
        );
        expect(Markdown.format('([link](http://example.com))').trim()).toBe(
            '<p>(<a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">link</a>)</p>',
        );

        expect(Markdown.format('(see [link](http://example.com))').trim()).toBe(
            '<p>(see <a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">link</a>)</p>',
        );

        expect(Markdown.format('([link](http://example.com) watch this)').trim()).toBe(
            '<p>(<a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">link</a> watch this)</p>',
        );

        expect(Markdown.format('(test@example.com)').trim()).toBe(
            '<p>(<a class="theme" href="mailto:test@example.com" rel="noreferrer" target="_blank">test@example.com</a>)</p>',
        );

        expect(Markdown.format('(email test@example.com)').trim()).toBe(
            '<p>(email <a class="theme" href="mailto:test@example.com" rel="noreferrer" target="_blank">test@example.com</a>)</p>',
        );

        expect(Markdown.format('(test@example.com email)').trim()).toBe(
            '<p>(<a class="theme" href="mailto:test@example.com" rel="noreferrer" target="_blank">test@example.com</a> email)</p>',
        );

        expect(Markdown.format('This is a sentence with a [link](http://example.com) in it.').trim()).toBe(
            '<p>This is a sentence with a <a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">link</a> in it.</p>',
        );

        expect(Markdown.format('This is a sentence with a link (http://example.com) in it.').trim()).toBe(
            '<p>This is a sentence with a link (<a class="theme markdown__link" href="http://example.com" rel="noreferrer" target="_blank">http://example.com</a>) in it.</p>',
        );

        expect(Markdown.format('This is a sentence with a (https://en.wikipedia.org/wiki/Rendering_(computer_graphics)) in it.').trim()).toBe(
            '<p>This is a sentence with a (<a class="theme markdown__link" href="https://en.wikipedia.org/wiki/Rendering_(computer_graphics)" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/Rendering_(computer_graphics)</a>) in it.</p>',
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

    it('Links containing %', () => {
        expect(Markdown.format('https://en.wikipedia.org/wiki/%C3%89').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://en.wikipedia.org/wiki/%C3%89" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/%C3%89</a></p>',
        );

        expect(Markdown.format('https://en.wikipedia.org/wiki/%E9').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://en.wikipedia.org/wiki/%E9" rel="noreferrer" target="_blank">https://en.wikipedia.org/wiki/%E9</a></p>',
        );
    });

    it('Relative link', () => {
        expect(Markdown.format('[A Relative Link](/static/files/5b4a7904a3e041018526a00dba59ee48.png)').trim()).toBe(
            '<p><a class="theme markdown__link" href="/static/files/5b4a7904a3e041018526a00dba59ee48.png" rel="noreferrer" target="_blank">A Relative Link</a></p>',
        );
    });

    describe('autolinkedUrlSchemes', () => {
        test('only some types of links are rendered when there are custom URL schemes defined', () => {
            jest.spyOn(store, 'getState').mockReturnValue(makeInitialState({
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

            expect(Markdown.format('test.:test').trim()).toBe('<p>test.:test</p>');

            expect(Markdown.format('taco+what://example.com').trim()).toBe('<p>taco+what://example.com</p>');

            expect(Markdown.format('taco.what://example.com').trim()).toBe('<p>taco.what://example.com</p>');
        });

        test('matching links are rendered when schemes are provided', () => {
            jest.spyOn(store, 'getState').mockReturnValue(makeInitialState({
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

            expect(Markdown.format('https://example.com').trim()).toBe(`<p>${link('https://example.com')}</p>`);

            expect(Markdown.format('ftp://ftp.example.com').trim()).toBe(`<p>${link('ftp://ftp.example.com')}</p>`);

            expect(Markdown.format('tel:1-555-123-4567').trim()).toBe(`<p>${link('tel:1-555-123-4567')}</p>`);

            expect(Markdown.format('mailto:test@example.com').trim()).toBe(`<p>${link('mailto:test@example.com')}</p>`);

            // These are linked since they're configured on the server
            expect(Markdown.format('git://git.example.com').trim()).toBe(`<p>${link('git://git.example.com')}</p>`);

            expect(Markdown.format('test:test').trim()).toBe(`<p>${link('test:test')}</p>`);

            expect(Markdown.format('test.:test').trim()).toBe(`<p>${link('test.:test')}</p>`);

            expect(Markdown.format('taco+what://example.com').trim()).toBe(`<p>${link('taco+what://example.com')}</p>`);

            expect(Markdown.format('taco.what://example.com').trim()).toBe(`<p>${link('taco.what://example.com')}</p>`);
        });

        test('explicit links are not affected by this setting', () => {
            jest.spyOn(store, 'getState').mockReturnValue(makeInitialState({
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
