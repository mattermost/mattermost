// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {decodeHtmlEntities} from './decode_html_entities';

describe('decodeHtmlEntities', () => {
    describe('basic functionality', () => {
        test('should pass through plain text unchanged', () => {
            expect(decodeHtmlEntities('Hello World')).toBe('Hello World');
        });

        test('should handle empty string', () => {
            expect(decodeHtmlEntities('')).toBe('');
        });

        test('should handle string with only whitespace', () => {
            expect(decodeHtmlEntities('   \t\n  ')).toBe('   \t\n  ');
        });

        test('should handle very long strings without entities', () => {
            const long = 'a'.repeat(10000);
            expect(decodeHtmlEntities(long)).toBe(long);
        });
    });

    describe('numeric entity decoding (decimal)', () => {
        test('should decode all supported numeric entities', () => {
            const expectedMappings: Record<string, string> = {
                '&#33;': '!',
                '&#34;': '"',
                '&#35;': '#',
                '&#38;': '&',
                '&#39;': "'",
                '&#40;': '(',
                '&#41;': ')',
                '&#42;': '*',
                '&#43;': '+',
                '&#45;': '-',
                '&#46;': '.',
                '&#47;': '/',
                '&#58;': ':',
                '&#59;': ';',
                '&#60;': '<',
                '&#61;': '=',
                '&#62;': '>',
                '&#63;': '?',
                '&#64;': '@',
                '&#91;': '[',
                '&#92;': '\\',
                '&#93;': ']',
                '&#94;': '^',
                '&#95;': '_',
                '&#96;': '`',
                '&#123;': '{',
                '&#124;': '|',
                '&#125;': '}',
                '&#126;': '~',
            };

            for (const [entity, expected] of Object.entries(expectedMappings)) {
                expect(decodeHtmlEntities(entity)).toBe(expected);
            }
        });

        test('should decode multiple numeric entities in sequence', () => {
            expect(decodeHtmlEntities('&#33;&#35;&#40;&#41;&#42;')).toBe('!#()*');
        });

        test('should handle numeric entities embedded in text', () => {
            expect(decodeHtmlEntities('Hello &#40;World&#41;')).toBe('Hello (World)');
        });
    });

    describe('named entity decoding', () => {
        test('should decode &amp;', () => {
            expect(decodeHtmlEntities('cats &amp; dogs')).toBe('cats & dogs');
        });

        test('should decode &lt;', () => {
            expect(decodeHtmlEntities('1 &lt; 2')).toBe('1 < 2');
        });

        test('should decode &gt;', () => {
            expect(decodeHtmlEntities('2 &gt; 1')).toBe('2 > 1');
        });

        test('should decode &quot;', () => {
            expect(decodeHtmlEntities('&quot;hello&quot;')).toBe('"hello"');
        });

        test('should decode &apos;', () => {
            expect(decodeHtmlEntities('it&apos;s')).toBe("it's");
        });

        test('should decode all named entities together', () => {
            expect(decodeHtmlEntities('&amp;&lt;&gt;&quot;&apos;')).toBe('&<>"\'');
        });
    });

    describe('mixed entities', () => {
        test('should decode numeric and named entities in the same string', () => {
            expect(decodeHtmlEntities('&#60;div&gt; &amp; &#40;test&#41;')).toBe('<div> & (test)');
        });

        test('should handle entities adjacent to each other', () => {
            expect(decodeHtmlEntities('&#40;&#41;')).toBe('()');
            expect(decodeHtmlEntities('&lt;&gt;')).toBe('<>');
            expect(decodeHtmlEntities('&amp;&#38;')).toBe('&&');
        });

        test('should handle multiple occurrences of the same entity', () => {
            expect(decodeHtmlEntities('&#40;a&#40;b&#40;c')).toBe('(a(b(c');
        });
    });

    describe('entities that should NOT be decoded', () => {
        test('should not decode unknown named entities', () => {
            expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
            expect(decodeHtmlEntities('&nbsp;')).toBe('&nbsp;');
            expect(decodeHtmlEntities('&copy;')).toBe('&copy;');
            expect(decodeHtmlEntities('&mdash;')).toBe('&mdash;');
            expect(decodeHtmlEntities('&hellip;')).toBe('&hellip;');
        });

        test('should not decode unsupported numeric entities', () => {
            expect(decodeHtmlEntities('&#999;')).toBe('&#999;');
            expect(decodeHtmlEntities('&#0;')).toBe('&#0;');
            expect(decodeHtmlEntities('&#128512;')).toBe('&#128512;');
            expect(decodeHtmlEntities('&#9999;')).toBe('&#9999;');
        });

        test('should not decode hex entities', () => {
            expect(decodeHtmlEntities('&#x28;')).toBe('&#x28;');
            expect(decodeHtmlEntities('&#x3C;')).toBe('&#x3C;');
            expect(decodeHtmlEntities('&#x3E;')).toBe('&#x3E;');
            expect(decodeHtmlEntities('&#X28;')).toBe('&#X28;');
        });

        test('should not decode entities that are case-sensitive mismatches', () => {
            expect(decodeHtmlEntities('&AMP;')).toBe('&AMP;');
            expect(decodeHtmlEntities('&LT;')).toBe('&LT;');
            expect(decodeHtmlEntities('&GT;')).toBe('&GT;');
            expect(decodeHtmlEntities('&Amp;')).toBe('&Amp;');
        });
    });

    describe('partial / malformed entity-like strings', () => {
        test('should not decode entities missing the trailing semicolon', () => {
            expect(decodeHtmlEntities('&#40')).toBe('&#40');
            expect(decodeHtmlEntities('&amp')).toBe('&amp');
        });

        test('should not decode entities missing the leading ampersand', () => {
            expect(decodeHtmlEntities('#40;')).toBe('#40;');
            expect(decodeHtmlEntities('lt;')).toBe('lt;');
        });

        test('should handle bare ampersands', () => {
            expect(decodeHtmlEntities('this & that')).toBe('this & that');
        });

        test('should handle bare semicolons', () => {
            expect(decodeHtmlEntities('a; b; c;')).toBe('a; b; c;');
        });

        test('should handle ampersand followed by number without hash', () => {
            expect(decodeHtmlEntities('&40;')).toBe('&40;');
        });

        test('should not be confused by entity-like substrings in longer tokens', () => {
            expect(decodeHtmlEntities('x&#40;y')).toBe('x(y');
            expect(decodeHtmlEntities('abc&amp;def')).toBe('abc&def');
        });
    });

    describe('double-encoding safety (no recursive decoding)', () => {
        test('should not double-decode &amp;lt; — only one level', () => {
            // &amp;lt; → first decode &amp; to & → result is &lt;
            // It should NOT further decode &lt; to <
            expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
        });

        test('should not double-decode &amp;amp;', () => {
            expect(decodeHtmlEntities('&amp;amp;')).toBe('&amp;');
        });

        test('should not double-decode &amp;gt;', () => {
            expect(decodeHtmlEntities('&amp;gt;')).toBe('&gt;');
        });

        test('should not double-decode &amp;quot;', () => {
            expect(decodeHtmlEntities('&amp;quot;')).toBe('&quot;');
        });

        test('should not double-decode &amp;#40;', () => {
            expect(decodeHtmlEntities('&amp;#40;')).toBe('&#40;');
        });

        test('idempotency: decoding already-decoded text should be a no-op for safe characters', () => {
            const plain = 'Hello (World) - it\'s "great" & fun!';
            expect(decodeHtmlEntities(plain)).toBe(plain);
        });
    });

    describe('security: XSS and injection resistance', () => {
        test('should decode script tags to literal text (safe in React JSX context)', () => {
            const input = '&#60;script&#62;alert&#40;1&#41;&#60;/script&#62;';
            const result = decodeHtmlEntities(input);
            expect(result).toBe('<script>alert(1)</script>');

            // Note: This decoded string is rendered via React JSX {text} which
            // escapes it to &lt;script&gt; in the DOM — no XSS risk.
        });

        test('should decode event handler attributes (safe in React JSX context)', () => {
            const input = '&#60;img src&#61;x onerror&#61;alert&#40;1&#41;&#62;';
            const result = decodeHtmlEntities(input);
            expect(result).toBe('<img src=x onerror=alert(1)>');
        });

        test('should decode javascript: protocol strings (safe in React JSX context)', () => {
            const input = 'javascript&#58;alert&#40;document.cookie&#41;';
            const result = decodeHtmlEntities(input);

            // eslint-disable-next-line no-script-url -- intentionally asserting decoded output contains a script URL
            expect(result).toBe('javascript:alert(document.cookie)');
        });

        test('should decode data: URI (safe in React JSX context)', () => {
            const input = 'data&#58;text/html,&#60;script&#62;alert&#40;1&#41;&#60;/script&#62;';
            const result = decodeHtmlEntities(input);
            expect(result).toBe('data:text/html,<script>alert(1)</script>');
        });

        test('should decode iframe injection attempt (safe in React JSX context)', () => {
            const input = '&#60;iframe src&#61;&quot;https://evil.com&quot;&#62;&#60;/iframe&#62;';
            const result = decodeHtmlEntities(input);
            expect(result).toBe('<iframe src="https://evil.com"></iframe>');
        });

        test('should handle SQL injection-like content without alteration', () => {
            const input = "'; DROP TABLE users; --";
            expect(decodeHtmlEntities(input)).toBe("'; DROP TABLE users; --");
        });

        test('should handle template literal injection attempts', () => {
            // &#36; (dollar sign) is not in the decode map — only a specific allowlist is decoded
            const input = '&#96;&#36;&#123;alert&#40;1&#41;&#125;&#96;';
            expect(decodeHtmlEntities(input)).toBe('`&#36;{alert(1)}`');
        });
    });

    describe('interaction with markdown-like syntax', () => {
        test('should decode entities that produce markdown bold syntax', () => {
            // &#42;&#42;text&#42;&#42; → **text** — but this is just decoded text,
            // it won't be re-parsed as markdown because we use this in JSX text context
            expect(decodeHtmlEntities('&#42;&#42;bold&#42;&#42;')).toBe('**bold**');
        });

        test('should decode entities that produce markdown italic syntax', () => {
            expect(decodeHtmlEntities('&#42;italic&#42;')).toBe('*italic*');
        });

        test('should decode entities that produce markdown link syntax', () => {
            expect(decodeHtmlEntities('&#91;link&#93;&#40;http://example.com&#41;')).toBe('[link](http://example.com)');
        });

        test('should decode entities that produce markdown heading syntax', () => {
            expect(decodeHtmlEntities('&#35; Heading')).toBe('# Heading');
        });

        test('should decode entities that produce markdown strikethrough syntax', () => {
            expect(decodeHtmlEntities('&#126;&#126;deleted&#126;&#126;')).toBe('~~deleted~~');
        });

        test('should decode entities that produce markdown code syntax', () => {
            expect(decodeHtmlEntities('&#96;code&#96;')).toBe('`code`');
        });

        test('should decode entities that produce markdown table syntax', () => {
            expect(decodeHtmlEntities('&#124; A &#124; B &#124;')).toBe('| A | B |');
        });
    });

    describe('realistic plugin payloads', () => {
        test('Google Calendar: event title with parentheses', () => {
            expect(decodeHtmlEntities(
                'Future Plan for Plugins Stack &#40;3rd party &amp; core features as plugins&#41;',
            )).toBe(
                'Future Plan for Plugins Stack (3rd party & core features as plugins)',
            );
        });

        test('Google Calendar: event with time and special chars', () => {
            expect(decodeHtmlEntities(
                'Team Standup &#40;Daily&#41; &#45; 9&#58;00 AM',
            )).toBe(
                'Team Standup (Daily) - 9:00 AM',
            );
        });

        test('MS Calendar: event with quotes in title', () => {
            expect(decodeHtmlEntities(
                '&quot;All Hands&quot; Meeting &#40;Q1 Review&#41;',
            )).toBe(
                '"All Hands" Meeting (Q1 Review)',
            );
        });

        test('plugin sending author name with encoded characters', () => {
            expect(decodeHtmlEntities(
                'Bot &#40;v2.1&#41; &amp; Integrations',
            )).toBe(
                'Bot (v2.1) & Integrations',
            );
        });

        test('plugin footer with encoded characters', () => {
            expect(decodeHtmlEntities(
                'Google Calendar &#124; via Plugin &#40;v1.0&#41;',
            )).toBe(
                'Google Calendar | via Plugin (v1.0)',
            );
        });
    });

    describe('unicode and special character handling', () => {
        test('should not alter emoji', () => {
            expect(decodeHtmlEntities('Hello 👋 World 🌍')).toBe('Hello 👋 World 🌍');
        });

        test('should not alter non-ASCII text', () => {
            expect(decodeHtmlEntities('日本語テスト')).toBe('日本語テスト');
        });

        test('should decode entities within text containing emoji', () => {
            expect(decodeHtmlEntities('Meeting 🗓 &#40;Q1&#41;')).toBe('Meeting 🗓 (Q1)');
        });

        test('should decode entities within text containing accented characters', () => {
            expect(decodeHtmlEntities('Réunion &#40;équipe&#41;')).toBe('Réunion (équipe)');
        });
    });

    describe('boundary and edge cases', () => {
        test('should handle entity at the very start of string', () => {
            expect(decodeHtmlEntities('&#40;start')).toBe('(start');
        });

        test('should handle entity at the very end of string', () => {
            expect(decodeHtmlEntities('end&#41;')).toBe('end)');
        });

        test('should handle string that is a single entity', () => {
            expect(decodeHtmlEntities('&amp;')).toBe('&');
        });

        test('should handle string that is entirely entities', () => {
            expect(decodeHtmlEntities('&lt;&gt;')).toBe('<>');
        });

        test('should handle entities separated by newlines', () => {
            expect(decodeHtmlEntities('&#40;\n&#41;')).toBe('(\n)');
        });

        test('should handle entities surrounded by spaces', () => {
            expect(decodeHtmlEntities(' &#40; &#41; ')).toBe(' ( ) ');
        });

        test('should handle very long string with many entities', () => {
            const entity = '&#40;';
            const input = entity.repeat(500);
            const expected = '('.repeat(500);
            expect(decodeHtmlEntities(input)).toBe(expected);
        });
    });
});
