// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {localizeMessage} from 'utils/utils.jsx';
import {formatText} from 'utils/text_formatting.jsx';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default function HelpFormatting() {
    const message = [];
    message.push(localizeMessage('help.formatting.title', '# Formatting Text\n_____'));
    message.push(localizeMessage('help.formatting.intro', 'Markdown makes it easy to format messages. Type a message as you normally would, and use these rules to render it with special formatting.'));
    message.push(localizeMessage('help.formatting.style', '## Text Style\n\nYou can use either `_` or `*` around a word to make it italic. Use two to make it bold.\n\n* `_italics_` renders as _italics_\n* `**bold**` renders as **bold**\n* `**_bold-italic_**` renders as **_bold-italics_**\n* `~~strikethrough~~` renders as ~~strikethrough~~'));
    message.push(localizeMessage('help.formatting.code', '## Code Block\n\nCreate a code block by indenting each line by four spaces, or by placing ``` on the line above and below your code.'));
    message.push(localizeMessage('help.formatting.example', 'Example:') + '\n\n');
    message.push('    ```\n    ' + localizeMessage('help.formatting.codeBlock', 'code block') + '\n    ```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push('```\n' + localizeMessage('help.formatting.codeBlock', 'code block') + '\n```');
    message.push(localizeMessage('help.formatting.syntax', '### Syntax Highlighting\n\nTo add syntax highlighting, type the language to be highlighted after the ``` at the beginning of the code block. Mattermost also offers four different code themes (GitHub, Solarized Dark, Solarized Light, Monokai) that can be changed in **Account Settings** > **Display** > **Theme** > **Custom Theme** > **Center Channel Styles**'));
    message.push(localizeMessage('help.formatting.supportedSyntax', 'Supported languages are:\n`as`, `applescript`, `osascript`, `scpt`, `bash`, `sh`, `zsh`, `clj`, `boot`, `cl2`, `cljc`, `cljs`, `cljs.hl`, `cljscm`, `cljx`, `hic`, `coffee`, `_coffee`, `cake`, `cjsx`, `cson`, `iced`, `cpp`, `c`, `cc`, `h`, `c++`, `h++`, `hpp`, `cs`, `csharp`, `css`, `d`, `di`, `dart`, `delphi`, `dpr`, `dfm`, `pas`, `pascal`, `freepascal`, `lazarus`, `lpr`, `lfm`, `diff`, `django`, `jinja`, `dockerfile`, `docker`, `erl`, `f90`, `f95`, `fsharp`, `fs`, `gcode`, `nc`, `go`, `groovy`, `handlebars`, `hbs`, `html.hbs`, `html.handlebars`, `hs`, `hx`, `java`, `jsp`, `js`, `jsx`, `json`, `jl`, `kt`, `ktm`, `kts`, `less`, `lisp`, `lua`, `mk`, `mak`, `md`, `mkdown`, `mkd`, `matlab`, `m`, `mm`, `objc`, `obj-c`, `ml`, `perl`, `pl`, `php`, `php3`, `php4`, `php5`, `php6`, `ps`, `ps1`, `pp`, `py`, `gyp`, `r`, `ruby`, `rb`, `gemspec`, `podspec`, `thor`, `irb`, `rs`, `scala`, `scm`, `sld`, `scss`, `st`, `sql`, `swift`, `tex`, `vbnet`, `vb`, `bas`, `vbs`, `v`, `veo`, `xml`, `html`, `xhtml`, `rss`, `atom`, `xsl`, `plist`, `yaml`'));
    message.push(localizeMessage('help.formatting.example', 'Example:') + '\n\n');
    message.push('    ```go\n' + localizeMessage('help.formatting.syntaxEx', '    package main\n    import "fmt"\n    func main() {\n        fmt.Println("Hello, 世界")\n    }') + '\n    ```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.githubTheme', '**GitHub Theme**'));
    message.push('![go syntax-highlighting](https://docs.mattermost.com/_images/syntax-highlighting-github.PNG)');
    message.push(localizeMessage('help.formatting.solirizedDarkTheme', '**Solarized Dark Theme**'));
    message.push('![go syntax-highlighting](https://docs.mattermost.com/_images/syntax-highlighting-sol-dark.PNG)');
    message.push(localizeMessage('help.formatting.solirizedLightTheme', '**Solarized Light Theme**'));
    message.push('![go syntax-highlighting](https://docs.mattermost.com/_images/syntax-highlighting-sol-light.PNG)');
    message.push(localizeMessage('help.formatting.monokaiTheme', '**Monokai Theme**'));
    message.push('![go syntax-highlighting](https://docs.mattermost.com/_images/syntax-highlighting-monokai.PNG)');
    message.push(localizeMessage('help.formatting.inline', '## In-line Code\n\nCreate in-line monospaced font by surrounding it with backticks.'));
    message.push('```\n`monospace`\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:') + ' `monospace`');
    message.push(localizeMessage('help.formatting.links', '## Links\n\nCreate labeled links by putting the desired text in square brackets and the associated link in normal brackets.'));
    message.push('`' + localizeMessage('help.formatting.linkEx', '[Check out Mattermost!](https://about.mattermost.com/)') + '`');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:') + ' ' + localizeMessage('help.formatting.linkEx', '[Check out Mattermost!](https://about.mattermost.com/)'));
    message.push(localizeMessage('help.formatting.images', '## In-line Images\n\nCreate in-line images using an `!` followed by the alt text in square brackets and the link in normal brackets. Add hover text by placing it in quotes after the link.'));
    message.push('```\n' + localizeMessage('help.formatting.imagesExample', '![alt text](link "hover text")\n\nand\n\n[![Build Status](https://travis-ci.org/mattermost/platform.svg?branch=master)](https://travis-ci.org/mattermost/platform) [![Github](https://assets-cdn.github.com/favicon.ico)](https://github.com/mattermost/platform)') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.imagesExample', '![alt text](link "hover text")\n\nand\n\n[![Build Status](https://travis-ci.org/mattermost/platform.svg?branch=master)](https://travis-ci.org/mattermost/platform) [![Github](https://assets-cdn.github.com/favicon.ico)](https://github.com/mattermost/platform)'));
    message.push(localizeMessage('help.formatting.emojis', '## Emojis\n\nOpen the emoji autocomplete by typing `:`. A full list of emojis can be found [here](http://www.emoji-cheat-sheet.com/). It is also possible to create your own [Custom Emoji](http://docs.mattermost.com/help/settings/custom-emoji.html) if the emoji you want to use doesn\'t exist.'));
    message.push('```\n' + localizeMessage('help.formatting.emojiExample', ':smile: :+1: :sheep:') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.emojiExample', ':smile: :+1: :sheep:'));
    message.push(localizeMessage('help.formatting.lines', '## Lines\n\nCreate a line by using three `*`, `_`, or `-`.'));
    message.push('`***` ' + localizeMessage('help.formatting.renders', 'Renders as:') + '\n***');
    message.push(localizeMessage('help.formatting.quotes', '## Block quotes\n\nCreate block quotes using `>`.'));
    message.push(localizeMessage('help.formatting.quotesExample', '`> block quotes` renders as:'));
    message.push(localizeMessage('help.formatting.quotesRender', '> block quotes'));
    message.push(localizeMessage('help.formatting.lists', '## Lists\n\nCreate a list by using `*` or `-` as bullets. Indent a bullet point by adding two spaces in front of it.'));
    message.push('```\n' + localizeMessage('help.formatting.listExample', '* list item one\n* list item two\n    * item two sub-point') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.listExample', '* list item one\n* list item two\n    * item two sub-point'));
    message.push(localizeMessage('help.formatting.ordered', 'Make it an ordered list by using numbers instead:'));
    message.push('```\n' + localizeMessage('help.formatting.orderedExample', '1. Item one\n2. Item two') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.orderedExample', '1. Item one\n2. Item two'));
    message.push(localizeMessage('help.formatting.checklist', 'Make a task list by including square brackets:'));
    message.push('```\n' + localizeMessage('help.formatting.checklistExample', '- [ ] Item one\n- [ ] Item two\n- [x] Completed item') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.checklistExample', '- [ ] Item one\n- [ ] Item two\n- [x] Completed item'));
    message.push(localizeMessage('help.formatting.tables', '## Tables\n\nCreate a table by placing a dashed line under the header row and separating the columns with a pipe `|`. (The columns don’t need to line up exactly for it to work). Choose how to align table columns by including colons `:` within the header row.'));
    message.push('```\n' + localizeMessage('help.formatting.tableExample', '| Left-Aligned  | Center Aligned  | Right Aligned |\n| :------------ |:---------------:| -----:|\n| Left column 1 | this text       |  $100 |\n| Left column 2 | is              |   $10 |\n| Left column 3 | centered        |    $1 |') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.tableExample', '| Left-Aligned  | Center Aligned  | Right Aligned |\n| :------------ |:---------------:| -----:|\n| Left column 1 | this text       |  $100 |\n| Left column 2 | is              |   $10 |\n| Left column 3 | centered        |    $1 |'));
    message.push(localizeMessage('help.formatting.headings', '## Headings\n\nMake a heading by typing # and a space before your title. For smaller headings, use more #’s.'));
    message.push('```\n' + localizeMessage('help.formatting.headingsExample', '## Large Heading\n### Smaller Heading\n#### Even Smaller Heading') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.headingsExample', '## Large Heading\n### Smaller Heading\n#### Even Smaller Heading'));
    message.push(localizeMessage('help.formatting.headings2', 'Alternatively, you can underline the text using `===` or `---` to create headings.'));
    message.push('```\n' + localizeMessage('help.formatting.headings2Example', 'Large Heading\n-------------') + '\n```');
    message.push(localizeMessage('help.formatting.renders', 'Renders as:'));
    message.push(localizeMessage('help.formatting.headings2Example', 'Large Heading\n-------------'));

    return (
        <div>
            <span
                dangerouslySetInnerHTML={{__html: formatText(message.join('\n\n'))}}
            />
            <p className='links'>
                <FormattedMessage
                    id='help.learnMore'
                    defaultMessage='Learn more about:'
                />
            </p>
            <ul>
                <li>
                    <Link to='/help/messaging'>
                        <FormattedMessage
                            id='help.link.messaging'
                            defaultMessage='Basic Messaging'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/composing'>
                        <FormattedMessage
                            id='help.link.composing'
                            defaultMessage='Composing Messages and Replies'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/mentioning'>
                        <FormattedMessage
                            id='help.link.mentioning'
                            defaultMessage='Mentioning Teammates'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/attaching'>
                        <FormattedMessage
                            id='help.link.attaching'
                            defaultMessage='Attaching Files'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/commands'>
                        <FormattedMessage
                            id='help.link.commands'
                            defaultMessage='Executing Commands'
                        />
                    </Link>
                </li>
            </ul>
        </div>
    );
}
