// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import highlightJs from 'highlight.js/lib/highlight.js';
import highlightJsDiff from 'highlight.js/lib/languages/diff.js';
import highlightJsApache from 'highlight.js/lib/languages/apache.js';
import highlightJsMakefile from 'highlight.js/lib/languages/makefile.js';
import highlightJsHttp from 'highlight.js/lib/languages/http.js';
import highlightJsJson from 'highlight.js/lib/languages/json.js';
import highlightJsMarkdown from 'highlight.js/lib/languages/markdown.js';
import highlightJsJavascript from 'highlight.js/lib/languages/javascript.js';
import highlightJsCss from 'highlight.js/lib/languages/css.js';
import highlightJsNginx from 'highlight.js/lib/languages/nginx.js';
import highlightJsObjectivec from 'highlight.js/lib/languages/objectivec.js';
import highlightJsPython from 'highlight.js/lib/languages/python.js';
import highlightJsXml from 'highlight.js/lib/languages/xml.js';
import highlightJsPerl from 'highlight.js/lib/languages/perl.js';
import highlightJsBash from 'highlight.js/lib/languages/bash.js';
import highlightJsPhp from 'highlight.js/lib/languages/php.js';
import highlightJsCoffeescript from 'highlight.js/lib/languages/coffeescript.js';
import highlightJsCs from 'highlight.js/lib/languages/cs.js';
import highlightJsCpp from 'highlight.js/lib/languages/cpp.js';
import highlightJsSql from 'highlight.js/lib/languages/sql.js';
import highlightJsGo from 'highlight.js/lib/languages/go.js';
import highlightJsRuby from 'highlight.js/lib/languages/ruby.js';
import highlightJsJava from 'highlight.js/lib/languages/java.js';
import highlightJsIni from 'highlight.js/lib/languages/ini.js';

highlightJs.registerLanguage('diff', highlightJsDiff);
highlightJs.registerLanguage('apache', highlightJsApache);
highlightJs.registerLanguage('makefile', highlightJsMakefile);
highlightJs.registerLanguage('http', highlightJsHttp);
highlightJs.registerLanguage('json', highlightJsJson);
highlightJs.registerLanguage('markdown', highlightJsMarkdown);
highlightJs.registerLanguage('javascript', highlightJsJavascript);
highlightJs.registerLanguage('css', highlightJsCss);
highlightJs.registerLanguage('nginx', highlightJsNginx);
highlightJs.registerLanguage('objectivec', highlightJsObjectivec);
highlightJs.registerLanguage('python', highlightJsPython);
highlightJs.registerLanguage('xml', highlightJsXml);
highlightJs.registerLanguage('perl', highlightJsPerl);
highlightJs.registerLanguage('bash', highlightJsBash);
highlightJs.registerLanguage('php', highlightJsPhp);
highlightJs.registerLanguage('coffeescript', highlightJsCoffeescript);
highlightJs.registerLanguage('cs', highlightJsCs);
highlightJs.registerLanguage('cpp', highlightJsCpp);
highlightJs.registerLanguage('sql', highlightJsSql);
highlightJs.registerLanguage('go', highlightJsGo);
highlightJs.registerLanguage('ruby', highlightJsRuby);
highlightJs.registerLanguage('java', highlightJsJava);
highlightJs.registerLanguage('ini', highlightJsIni);

import * as TextFormatting from './text_formatting.jsx';
import * as Utils from './utils.jsx';

import marked from 'marked';

import Constants from '../utils/constants.jsx';
const HighlightedLanguages = Constants.HighlightedLanguages;

function markdownImageLoaded(image) {
    image.style.height = 'auto';
}
window.markdownImageLoaded = markdownImageLoaded;

class MattermostInlineLexer extends marked.InlineLexer {
    constructor(links, options) {
        super(links, options);

        this.rules = Object.assign({}, this.rules);

        // modified version of the regex that allows for links starting with www and those surrounded by parentheses
        // the original is /^[\s\S]+?(?=[\\<!\[_*`~]|https?:\/\/| {2,}\n|$)/
        this.rules.text = /^[\s\S]+?(?=[\\<!\[_*`~]|https?:\/\/|www\.|\(| {2,}\n|$)/;

        // modified version of the regex that allows links starting with www and those surrounded by parentheses
        // the original is /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/
        this.rules.url = /^(\(?(?:https?:\/\/|www\.)[^\s<.][^\s<]*[^<.,:;"'\]\s])/;

        // modified version of the regex that allows <links> starting with www.
        // the original is /^<([^ >]+(@|:\/)[^ >]+)>/
        this.rules.autolink = /^<((?:[^ >]+(@|:\/)|www\.)[^ >]+)>/;
    }
}

class MattermostParser extends marked.Parser {
    parse(src) {
        this.inline = new MattermostInlineLexer(src.links, this.options, this.renderer);
        this.tokens = src.reverse();

        var out = '';
        while (this.next()) {
            out += this.tok();
        }

        return out;
    }
}

class MattermostMarkdownRenderer extends marked.Renderer {
    constructor(options, formattingOptions = {}) {
        super(options);

        this.heading = this.heading.bind(this);
        this.paragraph = this.paragraph.bind(this);
        this.text = this.text.bind(this);

        this.formattingOptions = formattingOptions;
    }

    code(code, language, escaped) {
        let usedLanguage = language || '';
        usedLanguage = usedLanguage.toLowerCase();

        // treat html as xml to prevent injection attacks
        if (usedLanguage === 'html') {
            usedLanguage = 'xml';
        }

        if (HighlightedLanguages[usedLanguage]) {
            const parsed = highlightJs.highlight(usedLanguage, code);

            return (
                '<div class="post-body--code">' +
                    '<span class="post-body--code__language">' +
                        HighlightedLanguages[usedLanguage] +
                    '</span>' +
                    '<pre>' +
                        '<code class="hljs">' +
                            parsed.value +
                        '</code>' +
                    '</pre>' +
                '</div>'
            );
        } else if (usedLanguage === 'tex' || usedLanguage === 'latex') {
            try {
                const html = katex.renderToString(code, {throwOnError: false, displayMode: true});

                return '<div class="post-body--code tex">' + html + '</div>';
            } catch (e) {
                // fall through if latex parsing fails and handle below
            }
        }

        return (
            '<pre>' +
                '<code class="hljs">' +
                    (escaped ? code : TextFormatting.sanitizeHtml(code)) + '\n' +
                '</code>' +
            '</pre>'
        );
    }

    codespan(text) {
        return '<span class="codespan__pre-wrap">' + super.codespan(text) + '</span>';
    }

    br() {
        if (this.formattingOptions.singleline) {
            return ' ';
        }

        return super.br();
    }

    image(href, title, text) {
        let out = '<img src="' + href + '" alt="' + text + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += ' onload="window.markdownImageLoaded(this)" onerror="window.markdownImageLoaded(this)" class="markdown-inline-img"';
        out += this.options.xhtml ? '/>' : '>';
        return out;
    }

    heading(text, level, raw) {
        const id = `${this.options.headerPrefix}${raw.toLowerCase().replace(/[^\w]+/g, '-')}`;
        return `<h${level} id="${id}" class="markdown__heading">${text}</h${level}>`;
    }

    link(href, title, text) {
        let outHref = href;
        let outText = text;
        let prefix = '';
        let suffix = '';

        // some links like https://en.wikipedia.org/wiki/Rendering_(computer_graphics) contain brackets
        // and we try our best to differentiate those from ones just wrapped in brackets when autolinking
        if (outHref.startsWith('(') && outHref.endsWith(')') && text === outHref) {
            prefix = '(';
            suffix = ')';
            outText = text.substring(1, text.length - 1);
            outHref = outHref.substring(1, outHref.length - 1);
        }

        try {
            const unescaped = decodeURIComponent(unescape(href)).replace(/[^\w:]/g, '').toLowerCase();

            if (unescaped.indexOf('javascript:') === 0 || unescaped.indexOf('vbscript:') === 0) { // eslint-disable-line no-script-url
                return '';
            }
        } catch (e) {
            return '';
        }

        if (!(/[a-z+.-]+:/i).test(outHref)) {
            outHref = `http://${outHref}`;
        }

        let output = '<a class="theme markdown__link" href="' + outHref + '"';
        if (title) {
            output += ' title="' + title + '"';
        }

        if (outHref.lastIndexOf(Utils.getTeamURLFromAddressBar(), 0) === 0) {
            output += '>';
        } else {
            output += ' target="_blank">';
        }

        output += outText + '</a>';

        return prefix + output + suffix;
    }

    paragraph(text) {
        if (this.formattingOptions.singleline) {
            return `<p class="markdown__paragraph-inline">${text}</p>`;
        }

        return super.paragraph(text);
    }

    table(header, body) {
        return `<div class="table-responsive"><table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    }

    listitem(text) {
        const taskListReg = /^\[([ |xX])\] /;
        const isTaskList = taskListReg.exec(text);

        if (isTaskList) {
            return `<li class="list-item--task-list">${'<input type="checkbox" disabled="disabled" ' + (isTaskList[1] === ' ' ? '' : 'checked="checked" ') + '/> '}${text.replace(taskListReg, '')}</li>`;
        }
        return `<li>${text}</li>`;
    }

    text(txt) {
        return TextFormatting.doFormatText(txt, this.formattingOptions);
    }
}

class MattermostLexer extends marked.Lexer {
    token(originalSrc, top, bq) {
        let src = originalSrc.replace(/^ +$/gm, '');

        while (src) {
            // newline
            let cap = this.rules.newline.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                if (cap[0].length > 1) {
                    this.tokens.push({
                        type: 'space'
                    });
                }
            }

            // code
            cap = this.rules.code.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                cap = cap[0].replace(/^ {4}/gm, '');
                this.tokens.push({
                    type: 'code',
                    text: this.options.pedantic ? cap : cap.replace(/\n+$/, '')
                });
                continue;
            }

            // fences (gfm)
            cap = this.rules.fences.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'code',
                    lang: cap[2],
                    text: cap[3] || ''
                });
                continue;
            }

            // heading
            cap = this.rules.heading.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'heading',
                    depth: cap[1].length,
                    text: cap[2]
                });
                continue;
            }

            // table no leading pipe (gfm)
            cap = this.rules.nptable.exec(src);
            if (top && cap) {
                src = src.substring(cap[0].length);

                const item = {
                    type: 'table',
                    header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                    align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: cap[3].replace(/\n$/, '').split('\n')
                };

                for (let i = 0; i < item.align.length; i++) {
                    if (/^ *-+: *$/.test(item.align[i])) {
                        item.align[i] = 'right';
                    } else if (/^ *:-+: *$/.test(item.align[i])) {
                        item.align[i] = 'center';
                    } else if (/^ *:-+ *$/.test(item.align[i])) {
                        item.align[i] = 'left';
                    } else {
                        item.align[i] = null;
                    }
                }

                for (let i = 0; i < item.cells.length; i++) {
                    item.cells[i] = item.cells[i].split(/ *\| */);
                }

                this.tokens.push(item);

                continue;
            }

            // lheading
            cap = this.rules.lheading.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'heading',
                    depth: cap[2] === '=' ? 1 : 2,
                    text: cap[1]
                });
                continue;
            }

            // hr
            cap = this.rules.hr.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'hr'
                });
                continue;
            }

            // blockquote
            cap = this.rules.blockquote.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);

                this.tokens.push({
                    type: 'blockquote_start'
                });

                cap = cap[0].replace(/^ *> ?/gm, '');

                // Pass `top` to keep the current
                // "toplevel" state. This is exactly
                // how markdown.pl works.
                this.token(cap, top, true);

                this.tokens.push({
                    type: 'blockquote_end'
                });

                continue;
            }

            // list
            cap = this.rules.list.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                const bull = cap[2];

                this.tokens.push({
                    type: 'list_start',
                    ordered: bull.length > 1
                });

                // Get each top-level item.
                cap = cap[0].match(this.rules.item);

                let next = false;
                const l = cap.length;
                let i = 0;

                for (; i < l; i++) {
                    let item = cap[i];

                    // Remove the list item's bullet
                    // so it is seen as the next token.
                    let space = item.length;
                    item = item.replace(/^ *([*+-]|\d+\.) +/, '');

                    // Outdent whatever the
                    // list item contains. Hacky.
                    if (~item.indexOf('\n ')) {
                        space -= item.length;
                        item = this.options.pedantic ?
                            item.replace(/^ {1,4}/gm, '') :
                            item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '');
                    }

                    // Determine whether the next list item belongs here.
                    // Backpedal if it does not belong in this list.
                    if (this.options.smartLists && i !== l - 1) {
                        const b = this.rules.bullet.exec(cap[i + 1])[0];
                        if (bull !== b && !(bull.length > 1 && b.length > 1)) {
                            src = cap.slice(i + 1).join('\n') + src;
                            i = l - 1;
                        }
                    }

                    // Determine whether item is loose or not.
                    // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
                    // for discount behavior.
                    let loose = next || (/\n\n(?!\s*$)/).test(item);
                    if (i !== l - 1) {
                        next = item.charAt(item.length - 1) === '\n';
                        if (!loose) {
                            loose = next;
                        }
                    }

                    this.tokens.push({
                        type: loose ?
                            'loose_item_start' :
                            'list_item_start'
                    });

                    // Recurse.
                    this.token(item, false, bq);

                    this.tokens.push({
                        type: 'list_item_end'
                    });
                }

                this.tokens.push({
                    type: 'list_end'
                });

                continue;
            }

            // html
            cap = this.rules.html.exec(src);
            if (cap) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: this.options.sanitize ? 'paragraph' : 'html',
                    pre: !this.options.sanitizer && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
                    text: cap[0]
                });
                continue;
            }

            // def
            cap = this.rules.def.exec(src);
            if ((!bq && top) && cap) {
                src = src.substring(cap[0].length);
                this.tokens.links[cap[1].toLowerCase()] = {
                    href: cap[2],
                    title: cap[3]
                };
                continue;
            }

            // table (gfm)
            cap = this.rules.table.exec(src);
            if (top && cap) {
                src = src.substring(cap[0].length);

                const item = {
                    type: 'table',
                    header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                    align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
                };

                for (let i = 0; i < item.align.length; i++) {
                    if (/^ *-+: *$/.test(item.align[i])) {
                        item.align[i] = 'right';
                    } else if (/^ *:-+: *$/.test(item.align[i])) {
                        item.align[i] = 'center';
                    } else if (/^ *:-+ *$/.test(item.align[i])) {
                        item.align[i] = 'left';
                    } else {
                        item.align[i] = null;
                    }
                }

                for (let i = 0; i < item.cells.length; i++) {
                    item.cells[i] = item.cells[i].replace(/^ *\| *| *\| *$/g, '').split(/ *\| */);
                }

                this.tokens.push(item);

                continue;
            }

            // top-level paragraph
            cap = this.rules.paragraph.exec(src);
            if (top && cap) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'paragraph',
                    text: cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1]
                });
                continue;
            }

            // text
            cap = this.rules.text.exec(src);
            if (cap) {
                // Top-level should never reach here.
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'text',
                    text: cap[0]
                });
                continue;
            }

            if (src) {
                throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }

        return this.tokens;
    }
}

export function format(text, options) {
    const markdownOptions = {
        renderer: new MattermostMarkdownRenderer(null, options),
        sanitize: true,
        gfm: true,
        tables: true
    };

    const tokens = new MattermostLexer(markdownOptions).lex(text);

    return new MattermostParser(markdownOptions).parse(tokens);
}

// Marked helper functions that should probably just be exported

function unescape(html) {
    return html.replace(/&([#\w]+);/g, (_, m) => {
        const n = m.toLowerCase();
        if (n === 'colon') {
            return ':';
        } else if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x' ?
                String.fromCharCode(parseInt(n.substring(2), 16)) :
                String.fromCharCode(+n.substring(1));
        }
        return '';
    });
}
