// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

import HelpLinks from './help_links';
import useHelpPageTitle from './use_help_page_title';

import './help.scss';

const title = defineMessage({id: 'help.formatting.title', defaultMessage: 'Formatting Messages Using Markdown'});

const HelpFormatting = (): JSX.Element => {
    useHelpPageTitle(title);

    return (
        <div className='Help'>
            <div className='Help__header'>
                <h1>
                    <FormattedMessage
                        id='help.formatting.title'
                        defaultMessage='Formatting Messages Using Markdown'
                    />
                </h1>
            </div>

            <div className='Help__content'>
                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.style.title'
                            defaultMessage='Text Style'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.style.description'
                            defaultMessage='You can use either <code>_</code> or <code>*</code> around a word to make it italic. Use two to make a word bold.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'_italic_'}</code></td>
                                <td><em>{'italic'}</em></td>
                            </tr>
                            <tr>
                                <td><code>{'**bold**'}</code></td>
                                <td><strong>{'bold'}</strong></td>
                            </tr>
                            <tr>
                                <td><code>{'~~strikethrough~~'}</code></td>
                                <td><del>{'strikethrough'}</del></td>
                            </tr>
                            <tr>
                                <td><code>{'**_bold-italic_**'}</code></td>
                                <td><strong><em>{'bold-italic'}</em></strong></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.code_block.title'
                            defaultMessage='Code Block'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.code_block.description'
                            defaultMessage='Create a code block by indenting each line by four spaces, or by placing <code>```</code> on the line above and below your code.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.code_block.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <code>{'```'}</code><br/>
                                    <code>{'Code block'}</code><br/>
                                    <code>{'```'}</code>
                                </td>
                                <td>
                                    <pre className='Help__code-preview'>{'Code block'}</pre>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.syntax.title'
                            defaultMessage='Syntax Highlighting'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.syntax.description'
                            defaultMessage='To add syntax highlighting, type the language to be highlighted after the <code>```</code> at the beginning of the code block. Mattermost also offers four different code themes (GitHub, Solarized Dark, Solarized Light, Monokai) that can be changed in <b>Settings > Display > Theme > Custom Theme > Center Channel Styles > Code Theme</b>.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.syntax.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <code>{'```go'}</code><br/>
                                    <code>{'package main'}</code><br/>
                                    <code>{'import "fmt"'}</code><br/>
                                    <code>{'func main() {'}</code><br/>
                                    <code>{'\u00A0\u00A0\u00A0\u00A0fmt.Println("Hello, 世界")'}</code><br/>
                                    <code>{'}'}</code><br/>
                                    <code>{'```'}</code>
                                </td>
                                <td>
                                    <pre className='Help__code-preview Help__code-preview--go'>
                                        <span className='Help__code-line'><span className='Help__code-line-number'>{'1'}</span><span className='Help__code-keyword'>{'package'}</span>{' main'}</span>
                                        <span className='Help__code-line'><span className='Help__code-line-number'>{'2'}</span><span className='Help__code-keyword'>{'import'}</span>{' "fmt"'}</span>
                                        <span className='Help__code-line'><span className='Help__code-line-number'>{'3'}</span><span className='Help__code-keyword'>{'func'}</span>{' main() {'}</span>
                                        <span className='Help__code-line'><span className='Help__code-line-number'>{'4'}</span>{'    fmt.Println("Hello, 世界")'}</span>
                                        <span className='Help__code-line'><span className='Help__code-line-number'>{'5'}</span>{'}'}</span>
                                    </pre>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.inline_code.title'
                            defaultMessage='In-line Code'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.inline_code.description'
                            defaultMessage='Create in-line monospaced font by surrounding it with backticks.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.inline_code.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'`monospace`'}</code></td>
                                <td><code className='Help__inline-code'>{'monospace'}</code></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
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
                    <p>
                        <FormattedMessage
                            id='help.formatting.links.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'[Check out Mattermost!](https://mattermost.com/)'}</code></td>
                                <td><a href='https://mattermost.com/'>{'Check out Mattermost!'}</a></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.images.title'
                            defaultMessage='In-line Images'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.images.description'
                            defaultMessage='Create in-line images using an <code>!</code> followed by the alt text in square brackets and the link in normal brackets. See the <link>product documentation</link> for details on working with in-line images.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                                link: (chunks: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/end-user-guide/collaborate/format-messages.html'
                                        location='help_formatting'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.images.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'![Mattermost Logo](/static/images/logo_email_dark.png)'}</code></td>
                                <td>
                                    <img
                                        src='/static/images/logo_email_dark.png'
                                        alt='Mattermost Logo'
                                        className='Help__inline-image'
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.emojis.title'
                            defaultMessage='Emojis'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.emojis.description'
                            defaultMessage={"Open the emoji autocomplete by typing <code>:</code>. A full list of emojis can be found online. It is also possible to create your own <link>Custom Emoji</link> if the emoji you want to use doesn't exist."}
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                                link: (chunks: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/end-user-guide/collaborate/react-with-emojis-gifs.html#upload-custom-emojis'
                                        location='help_formatting'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.emojis.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{':smile: :+1: :sheep:'}</code></td>
                                <td>{'😄 👍 🐑'}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.lines.title'
                            defaultMessage='Lines'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.lines.description'
                            defaultMessage='Create a line by using three <code>*</code>, <code>_</code>, or <code>-</code>.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.lines.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'---'}</code></td>
                                <td><hr className='Help__hr'/></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.blockquotes.title'
                            defaultMessage='Blockquotes'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.blockquotes.description'
                            defaultMessage='Create block quotes using <code>></code>.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.blockquotes.example_label'
                            defaultMessage='Example:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'> block quotes'}</code></td>
                                <td><blockquote className='Help__blockquote'>{'block quotes'}</blockquote></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.headings.title'
                            defaultMessage='Headings'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.headings.description'
                            defaultMessage={'Make a heading by typing <code>#</code> and a space before your title. For smaller headings, use multiple <code>#</code>. Alternatively, you can underline the text using <code>===</code> or <code>---</code> to create headings.'}
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.headings.this_text'
                            defaultMessage='This text'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <code>{'## Large Heading'}</code><br/>
                                    <code>{'### Smaller Heading'}</code><br/>
                                    <code>{'#### Even Smaller Heading'}</code>
                                </td>
                                <td>
                                    <span className='Help__heading-large'>{'Large Heading'}</span><br/>
                                    <span className='Help__heading-medium'>{'Smaller Heading'}</span><br/>
                                    <span className='Help__heading-small'>{'Even Smaller Heading'}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <code>{'Large Heading'}</code><br/>
                                    <code>{'-------------'}</code>
                                </td>
                                <td>
                                    <span className='Help__heading-large'>{'Large Heading'}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.lists.title'
                            defaultMessage='Lists'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.lists.description'
                            defaultMessage='Create a list by using <code>*</code> or <code>-</code> as bullets. Indent a bullet point by adding two spaces in front of it.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.lists.ordered'
                            defaultMessage='Make it an ordered list by using numbers instead.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.lists.task'
                            defaultMessage='Make a task list by including square brackets.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.lists.example_label'
                            defaultMessage='Examples:'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.formatting.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <code>{'* list item one'}</code><br/>
                                    <code>{'* list item two'}</code><br/>
                                    <code>{'\u00A0\u00A0* item two sub-point'}</code>
                                </td>
                                <td>
                                    <ul>
                                        <li>{'list item one'}</li>
                                        <li>{'list item two'}
                                            <ul>
                                                <li>{'item two sub-point'}</li>
                                            </ul>
                                        </li>
                                    </ul>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <code>{'1. Item one'}</code><br/>
                                    <code>{'2. Item two'}</code>
                                </td>
                                <td>
                                    <ol>
                                        <li>{'Item one'}</li>
                                        <li>{'Item two'}</li>
                                    </ol>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <code>{'- [ ] Item one'}</code><br/>
                                    <code>{'- [ ] Item two'}</code><br/>
                                    <code>{'- [x] Completed item'}</code>
                                </td>
                                <td>
                                    <ul className='Help__task-list'>
                                        <li>
                                            <input
                                                type='checkbox'
                                                disabled={true}
                                            />
                                            {' Item one'}
                                        </li>
                                        <li>
                                            <input
                                                type='checkbox'
                                                disabled={true}
                                            />
                                            {' Item two'}
                                        </li>
                                        <li>
                                            <input
                                                type='checkbox'
                                                checked={true}
                                                disabled={true}
                                            />
                                            {' Completed item'}
                                        </li>
                                    </ul>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.formatting.tables.title'
                            defaultMessage='Tables'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.formatting.tables.description'
                            defaultMessage={'Create a table by placing a dashed line under the header row and separating the columns with a pipe <code>|</code>. (The columns don\'t need to line up exactly for it to work). Choose how to align table columns by including colons <code>:</code> within the header row.'}
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.formatting.tables.this_text'
                            defaultMessage='This text:'
                        />
                    </p>
                    <div className='Help__code-block'>
                        <code>
                            {'| Left-Aligned  | Center Aligned  | Right Aligned |'}<br/>
                            {'| :------------ |:---------------:| -----:|'}<br/>
                            {'| Left column 1 | this text       |  $100 |'}<br/>
                            {'| Left column 2 | is              |   $10 |'}<br/>
                            {'| Left column 3 | centered        |    $1 |'}
                        </code>
                    </div>
                    <p>
                        <FormattedMessage
                            id='help.formatting.tables.renders_as'
                            defaultMessage='Renders as:'
                        />
                    </p>
                    <table className='Help__table Help__table--example'>
                        <thead>
                            <tr>
                                <th style={{textAlign: 'left'}}>{'Left-Aligned'}</th>
                                <th style={{textAlign: 'center'}}>{'Center-Aligned'}</th>
                                <th style={{textAlign: 'right'}}>{'Right-Aligned'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{textAlign: 'left'}}>{'Left column 1'}</td>
                                <td style={{textAlign: 'center'}}>{'this text'}</td>
                                <td style={{textAlign: 'right'}}>{'$100'}</td>
                            </tr>
                            <tr>
                                <td style={{textAlign: 'left'}}>{'Left column 2'}</td>
                                <td style={{textAlign: 'center'}}>{'is'}</td>
                                <td style={{textAlign: 'right'}}>{'$100'}</td>
                            </tr>
                            <tr>
                                <td style={{textAlign: 'left'}}>{'Left column 3'}</td>
                                <td style={{textAlign: 'center'}}>{'centered'}</td>
                                <td style={{textAlign: 'right'}}>{'$100'}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <HelpLinks excludePage='formatting'/>
            </div>
        </div>
    );
};

export default HelpFormatting;

