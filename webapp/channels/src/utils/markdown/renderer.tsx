// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked, {MarkedOptions} from 'marked';

import EmojiMap from 'utils/emoji_map';
import * as PostUtils from 'utils/post_utils';
import * as TextFormatting from 'utils/text_formatting';
import {getScheme, isUrlSafe, shouldOpenInNewTab} from 'utils/url';

import {parseImageDimensions} from './helpers';

export default class Renderer extends marked.Renderer {
    private formattingOptions: TextFormatting.TextFormattingOptions;
    private emojiMap: EmojiMap;
    public constructor(
        options: MarkedOptions,
        formattingOptions: TextFormatting.TextFormattingOptions,
        emojiMap = new EmojiMap(new Map()),
    ) {
        super(options);

        this.heading = this.heading.bind(this);
        this.paragraph = this.paragraph.bind(this);
        this.text = this.text.bind(this);
        this.emojiMap = emojiMap;

        this.formattingOptions = formattingOptions;
    }

    public code(code: string, language: string) {
        let usedLanguage = language || '';
        usedLanguage = usedLanguage.toLowerCase();

        if (usedLanguage === 'tex' || usedLanguage === 'latex') {
            return `<div data-latex="${TextFormatting.escapeHtml(code)}"></div>`;
        }

        let searchedContent = '';

        if (this.formattingOptions.searchPatterns) {
            const tokens = new Map();

            let searched = TextFormatting.sanitizeHtml(code);
            searched = TextFormatting.highlightSearchTerms(
                searched,
                tokens,
                this.formattingOptions.searchPatterns,
            );

            if (tokens.size > 0) {
                searched = TextFormatting.replaceTokens(searched, tokens);

                searchedContent = (
                    '<div class="post-code__search-highlighting">' +
                        searched +
                    '</div>'
                );
            }
        }

        return '<div data-codeblock-code="' + TextFormatting.escapeHtml(code) + '" ' +
                    'data-codeblock-language="' + TextFormatting.escapeHtml(usedLanguage) + '" ' +
                    'data-codeblock-searchedcontent="' + TextFormatting.escapeHtml(searchedContent) + '"></div>';
    }

    public codespan(text: string) {
        let output = text;

        if (this.formattingOptions.searchPatterns) {
            const tokens = new Map();
            output = TextFormatting.highlightSearchTerms(
                output,
                tokens,
                this.formattingOptions.searchPatterns,
            );
            output = TextFormatting.replaceTokens(output, tokens);
        }

        return (
            '<span class="codespan__pre-wrap">' +
                '<code>' +
                    output +
                '</code>' +
            '</span>'
        );
    }

    public br() {
        if (this.formattingOptions.singleline) {
            return ' ';
        }

        return super.br();
    }

    public image(href: string, title: string, text: string) {
        const dimensions = parseImageDimensions(href);

        let src = dimensions.href;
        src = PostUtils.getImageSrc(src, this.formattingOptions.proxyImages);

        let out = `<img src="${src}" alt="${text}"`;
        if (title) {
            out += ` title="${title}"`;
        }
        if (dimensions.width) {
            out += ` width="${dimensions.width}"`;
        }
        if (dimensions.height) {
            out += ` height="${dimensions.height}"`;
        }
        out += ' class="markdown-inline-img"';
        out += this.options.xhtml ? '/>' : '>';
        return out;
    }

    public heading(text: string, level: number) {
        return `<h${level} class="markdown__heading">${text}</h${level}>`;
    }

    public link(href: string, title: string, text: string, isUrl = false) {
        let outHref = href;

        if (!href.startsWith('/')) {
            const scheme = getScheme(href);
            if (!scheme) {
                outHref = `http://${outHref}`;
            } else if (isUrl && this.formattingOptions.autolinkedUrlSchemes) {
                const isValidUrl =
          this.formattingOptions.autolinkedUrlSchemes.indexOf(
              scheme.toLowerCase(),
          ) !== -1;

                if (!isValidUrl) {
                    return text;
                }
            }
        }

        if (!isUrlSafe(unescapeHtmlEntities(href))) {
            return text;
        }

        let output = '<a class="theme markdown__link';

        if (this.formattingOptions.searchPatterns) {
            for (const pattern of this.formattingOptions.searchPatterns) {
                if (pattern.pattern.test(href)) {
                    output += ' search-highlight';
                    break;
                }
            }
        }

        output += `" href="${outHref}" rel="noreferrer"`;

        const openInNewTab = shouldOpenInNewTab(outHref, this.formattingOptions.siteURL, this.formattingOptions.managedResourcePaths);

        if (openInNewTab || !this.formattingOptions.siteURL) {
            output += ' target="_blank"';
        } else {
            output += ` data-link="${outHref.replace(
                this.formattingOptions.siteURL,
                '',
            )}"`;
        }

        if (title) {
            output += ` title="${title}"`;
        }

        // remove any links added to the text by hashtag or mention parsing since they'll break this link
        output += '>' + text.replace(/<\/?a[^>]*>/g, '') + '</a>';

        return output;
    }

    public paragraph(text: string) {
        if (this.formattingOptions.singleline) {
            let result;
            if (text.includes('class="markdown-inline-img"')) {
                /*
         ** use a div tag instead of a p tag to allow other divs to be nested,
         ** which avoids errors of incorrect DOM nesting (<div> inside <p>)
         */
                result = `<span class="markdown__paragraph-inline">${text}</span>`;
            } else {
                result = `<p class="markdown__paragraph-inline">${text}</p>`;
            }
            return result;
        }

        return super.paragraph(text);
    }

    public table(header: string, body: string) {
        return `<div class="table-responsive"><table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    }

    public tablerow(content: string) {
        return `<tr>${content}</tr>`;
    }

    public tablecell(
        content: string,
        flags: {
            header: boolean;
            align: 'center' | 'left' | 'right' | null;
        },
    ) {
        return marked.Renderer.prototype.tablecell(content, flags).trim();
    }

    public list(content: string, ordered: boolean, start: number) {
        const type = ordered ? 'ol' : 'ul';

        let output = `<${type} className="markdown__list"`;
        if (ordered && start !== undefined) {
            // The CSS that we use for lists hides the actual counter and uses ::before to simulate one so that we can
            // style it properly. We need to use a CSS counter to tell the ::before elements which numbers to show.
            output += ` style="counter-reset: list ${start - 1}"`;
        }
        output += `>\n${content}</${type}>`;

        return output;
    }

    public listitem(text: string, bullet = '') { // eslint-disable-line @typescript-eslint/no-unused-vars
        const taskListReg = /^\[([ |xX])] /;
        const isTaskList = taskListReg.exec(text);

        if (isTaskList) {
            return `<li class="list-item--task-list">${'<input type="checkbox" disabled="disabled" ' +
        (isTaskList[1] === ' ' ? '' : 'checked="checked" ') +
        '/> '}${text.replace(taskListReg, '')}</li>`;
        }

        // Added a span because if not whitespace nodes only
        // works in Firefox but not in Webkit
        return `<li><span>${text}</span></li>`;
    }

    public text(txt: string) {
        return TextFormatting.doFormatText(
            txt,
            this.formattingOptions,
            this.emojiMap,
        );
    }
}

// Marked helper functions that should probably just be exported

function unescapeHtmlEntities(html: string) {
    return html.replace(/&([#\w]+);/g, (_, m) => {
        const n = m.toLowerCase();
        if (n === 'colon') {
            return ':';
        } else if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x' ?
                String.fromCharCode(parseInt(n.substring(2), 16)) :
                String.fromCharCode(Number(n.substring(1)));
        }
        return '';
    });
}
