// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import Markdown from 'components/markdown';
import HelpLinks from 'components/help/components/help_links';
import {HelpLink} from 'components/help/types';
import ExternalLink from 'components/external_link';

export default function HelpFormatting(): JSX.Element {
    const renderRawExample = (example: string | React.ReactNode): JSX.Element => {
        return (
            <div className='post-code post-code--wrap'>
                <code className='hljs'>{example}</code>
            </div>
        );
    };

    const renderRawExampleWithResult = (example: string | React.ReactNode): JSX.Element => {
        return (
            <div>
                {renderRawExample(example)}
                <p>
                    <FormattedMessage
                        id='help.formatting.renders'
                        defaultMessage='Renders as:'
                    />
                </p>
                {' '}
                <Markdown message={example ? example.toString() : ''}/>
            </div>
        );
    };

    return (
        <div>
            <h1 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.title'
                    defaultMessage='Formatting Messages Using Markdown'
                />
            </h1>
            <hr/>
            <p>
                <FormattedMessage
                    id='help.formatting.intro'
                    defaultMessage='Markdown makes it easy to format messages. Type a message as you normally would, then use the following syntax options to format your message a specific way.'
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.style.title'
                    defaultMessage='Text Style'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.style.description'
                    defaultMessage='You can use either `_` or `*` around a word to make it italic. Use two to make a word bold.'
                />
            </p>
            <ul>
                <li>
                    <FormattedMarkdownMessage
                        id='help.formatting.style.listItem1'
                        defaultMessage='`_italics_` renders as _italics_'
                    />
                </li>
                <li>
                    <FormattedMarkdownMessage
                        id='help.formatting.style.listItem2'
                        defaultMessage='`**bold**` renders as **bold**'
                    />
                </li>
                <li>
                    <FormattedMarkdownMessage
                        id='help.formatting.style.listItem3'
                        defaultMessage='`**_bold-italic_**` renders as **_bold-italics_**'
                    />
                </li>
                <li>
                    <FormattedMarkdownMessage
                        id='help.formatting.style.listItem4'
                        defaultMessage='`~~strikethrough~~` renders as ~~strikethrough~~'
                    />
                </li>
            </ul>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.code.title'
                    defaultMessage='Code Block'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.formatting.code.description'
                    defaultMessage='Create a code block by indenting each line by four spaces, or by placing ``` on the line above and below your code.'
                />
            </p>
            <p>
                <FormattedMessage
                    id='help.formatting.example'
                    defaultMessage='Example:'
                />
            </p>
            <FormattedMessage
                id='help.formatting.codeBlock'
                defaultMessage='Code block'
            >
                {(example) => renderRawExampleWithResult('```\n' + example + '\n```')}
            </FormattedMessage>
            <h3 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.syntax.title'
                    defaultMessage='Syntax Highlighting'
                />
            </h3>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.syntax.description'
                    defaultMessage='To add syntax highlighting, type the language to be highlighted after the ``` at the beginning of the code block. Mattermost also offers four different code themes (GitHub, Solarized Dark, Solarized Light, Monokai) that can be changed in **Settings > Display > Theme > Custom Theme > Center Channel Styles > Code Theme**.'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.supportedSyntax'
                    defaultMessage={'Supported languages are: `applescript`, `as`, `atom`, `bas`, `bash`, `boot`, `_coffee`, `c++`, `c`, `cake`, `cc`, `cl2`, `clj`, `cljc`, `cljs`, `cljs.hl`, `cljscm`, `cljx`, `cjsx`, `cson`, `coffee`, `cpp`, `cs`, `csharp`, `css`, `d`, `dart`, `dfm`, `di`, `delphi`, `diff`, `django`, `docker`, `dockerfile`, `dpr`, `erl`, `fortran`, `freepascal`, `fs`, `fsharp`, `gcode`, `gemspec`, `go`, `groovy`, `gyp`, `h++`, `h`, `handlebars`, `hbs`, `hic`, `hpp`, `html`, `html.handlebars`, `html.hbs`, `hs`, `hx`, `iced`, `irb`, `java`, `jinja`, `jl`, `js`, `json`, `jsp`, `jsx`, `kt`, `ktm`, `kts`, `latexcode`, `lazarus`, `less`, `lfm`, `lisp`, `lpr`, `lua`, `m`, `mak`, `matlab`, `md`, `mk`, `mkd`, `mkdown`, `ml`, `mm`, `nc`, `objc`, `obj-c`, `osascript`, `pas`, `pascal`, `perl`, `pgsql`, `php`, `php3`, `php4`, `php5`, `php6`, `pl`, `plist`, `podspec`, `postgres`, `postgresql`, `ps`, `ps1`, `pp`, `py`, `r`, `rb`, `rs`, `rss`, `ruby`, `scala`, `scm`, `scpt`, `scss`, `sh`, `sld`, `st`, `styl`, `sql`, `swift`, `tex`, `texcode`, `thor`, `ts`, `tsx`, `v`, `vb`, `vbnet`, `vbs`, `veo`, `xhtml`, `xml`, `xsl`, `yaml`, `zsh`.'}
                />
            </p>
            <p>
                <FormattedMessage
                    id='help.formatting.example'
                    defaultMessage='Example:'
                />
            </p>
            <FormattedMessage
                id='help.formatting.syntaxEx'
                defaultMessage={'```go\npackage main\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, 世界")\n}\n```'}
                values={{dummy: ''}}
            >
                {(example) => renderRawExample(example)}
            </FormattedMessage>
            <p>
                <FormattedMessage
                    id='help.formatting.renders'
                    defaultMessage='Renders as:'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.githubTheme'
                    defaultMessage='**GitHub Theme**'
                />
            </p>
            <p>
                <img
                    src='https://docs.mattermost.com/_images/syntax-highlighting-github.png'
                    alt='go syntax-highlighting'
                    className='markdown-inline-img'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.solirizedDarkTheme'
                    defaultMessage='**Solarized Dark Theme**'
                />
            </p>
            <p>
                <img
                    src='https://docs.mattermost.com/_images/syntax-highlighting-sol-dark.png'
                    alt='go syntax-highlighting'
                    className='markdown-inline-img'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.solirizedLightTheme'
                    defaultMessage='**Solarized Light Theme**'
                />
            </p>
            <p>
                <img
                    src='https://docs.mattermost.com/_images/syntax-highlighting-sol-light.png'
                    alt='go syntax-highlighting'
                    className='markdown-inline-img'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.monokaiTheme'
                    defaultMessage='**Monokai Theme**'
                />
            </p>
            <p>
                <img
                    src='https://docs.mattermost.com/_images/syntax-highlighting-monokai.png'
                    alt='go syntax-highlighting'
                    className='markdown-inline-img'
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.inline.title'
                    defaultMessage='In-line Code'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.formatting.inline.description'
                    defaultMessage='Create in-line monospaced font by surrounding it with backticks.'
                />
            </p>
            {renderRawExample('`monospace`')}
            <p>
                <FormattedMessage
                    id='help.formatting.renders'
                    defaultMessage='Renders as:'
                >
                    {(text) => (<Markdown message={text + ' `monospace`'}/>)}
                </FormattedMessage>
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.links.title'
                    defaultMessage='Links'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.formatting.links.description'
                    defaultMessage='Create labeled links by putting the desired text in square brackets and the associated link in normal brackets.'
                />
            </p>
            <FormattedMessage
                id='help.formatting.linkEx'
                defaultMessage={'[Check out Mattermost!](https://mattermost.com/)'}
            >
                {(example) => (
                    <div>
                        <Markdown message={'`' + example + '`'}/>
                        <FormattedMessage
                            id='help.formatting.renders'
                            defaultMessage='Renders as:'
                        >
                            {(text) => (<Markdown message={text + ' ' + example}/>)}
                        </FormattedMessage>
                    </div>
                )}
            </FormattedMessage>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.images.title'
                    defaultMessage='In-line Images'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.formatting.images.description'
                    defaultMessage='Create in-line images using an `!` followed by the alt text in square brackets and the link in normal brackets. Add hover text by placing it in quotes after the link. See the <link>product documentation</link> for details on working with in-line images.'
                    values={{
                        link: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='https://docs.mattermost.com/messaging/formatting-text.html#in-line-images'
                                location='formatting_help'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.emojis.title'
                    defaultMessage='Emojis'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.formatting.emojis.description'
                    defaultMessage={'Open the emoji autocomplete by typing `:`. A full list of emojis can be found <linkEmoji>online</linkEmoji>. It is also possible to create your own <linkCustomEmoji>Custom Emoji</linkCustomEmoji> if the emoji you want to use doesn\'t exist.'}
                    values={{
                        linkEmoji: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='http://www.emoji-cheat-sheet.com/'
                                location='formatting_help'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkCustomEmoji: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='https://docs.mattermost.com/messaging/using-emoji.html#creating-custom-emojis'
                                location='formatting_help'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
            {renderRawExampleWithResult(':smile: :+1: :sheep:')}
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.lines.title'
                    defaultMessage='Lines'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.lines.description'
                    defaultMessage='Create a line by using three `*`, `_`, or `-`.'
                />
            </p>
            <p>
                <FormattedMessage
                    id='help.formatting.renders'
                    defaultMessage='Renders as:'
                >
                    {(text) => <Markdown message={'`***` ' + text}/>}
                </FormattedMessage>
            </p>
            <Markdown message='***'/>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.quotes.title'
                    defaultMessage='Block quotes'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.quotes.description'
                    defaultMessage='Create block quotes using `>`.'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.quotesExample'
                    defaultMessage='`> block quotes` renders as:'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.quotesRender'
                    defaultMessage='> block quotes'
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.lists.title'
                    defaultMessage='Lists'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.lists.description'
                    defaultMessage='Create a list by using `*` or `-` as bullets. Indent a bullet point by adding two spaces in front of it.'
                />
            </p>
            <FormattedMessage
                id='help.formatting.listExample'
                defaultMessage={'* list item one\n* list item two\n    * item two sub-point'}
            >
                {(example) => renderRawExampleWithResult(example)}
            </FormattedMessage>
            <p>
                <FormattedMessage
                    id='help.formatting.ordered'
                    defaultMessage='Make it an ordered list by using numbers instead:'
                />
            </p>
            <FormattedMessage
                id='help.formatting.orderedExample'
                defaultMessage={'1. Item one\n2. Item two'}
            >
                {(example) => renderRawExampleWithResult(example)}
            </FormattedMessage>
            <p>
                <FormattedMessage
                    id='help.formatting.checklist'
                    defaultMessage='Make a task list by including square brackets:'
                />
            </p>
            <FormattedMessage
                id='help.formatting.checklistExample'
                defaultMessage={'- [ ] Item one\n- [ ] Item two\n- [x] Completed item'}
            >
                {(example) => renderRawExampleWithResult(example)}
            </FormattedMessage>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.tables.title'
                    defaultMessage='Tables'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.tables.description'
                    defaultMessage={'Create a table by placing a dashed line under the header row and separating the columns with a pipe `|`. (The columns don\'t need to line up exactly for it to work). Choose how to align table columns by including colons `:` within the header row.'}
                />
            </p>
            <FormattedMessage
                id='help.formatting.tableExample'
                defaultMessage={'| Left-Aligned  | Center Aligned  | Right Aligned |\n| :------------ |:---------------:| -----:|\n| Left column 1 | this text       |  $100 |\n| Left column 2 | is              |   $10 |\n| Left column 3 | centered        |    $1 |'}
            >
                {(example) => renderRawExampleWithResult(example)}
            </FormattedMessage>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.formatting.headings.title'
                    defaultMessage='Headings'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.formatting.headings.description'
                    defaultMessage={'Make a heading by typing # and a space before your title. For smaller headings, use more #\'s.'}
                />
            </p>
            <FormattedMessage
                id='help.formatting.headingsExample'
                defaultMessage={'## Large Heading\n### Smaller Heading\n#### Even Smaller Heading'}
            >
                {(example) => renderRawExampleWithResult(example)}
            </FormattedMessage>
            <p>
                <FormattedMarkdownMessage
                    id='help.formatting.headings2'
                    defaultMessage='Alternatively, you can underline the text using `===` or `---` to create headings.'
                />
            </p>
            <FormattedMessage
                id='help.formatting.headings2Example'
                defaultMessage={'Large Heading\n-------------'}
            >
                {(example) => renderRawExampleWithResult(example)}
            </FormattedMessage>
            <HelpLinks excludedLinks={[HelpLink.Formatting]}/>
        </div>
    );
}
