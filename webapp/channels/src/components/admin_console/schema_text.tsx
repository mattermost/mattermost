// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import marked from 'marked';

import FormattedMarkdownMessage, {CustomRenderer} from 'components/formatted_markdown_message';

type Props = {
    isMarkdown?: boolean;
    isTranslated?: boolean;
    text: string | object;
    textDefault?: string;
    textValues?: Record<string, React.ReactNode>;
}

export default class SchemaText extends React.PureComponent<Props> {
    static defaultProps = {
        isTranslated: true,
    };

    renderTranslated = () => {
        const {
            isMarkdown,
            text,
            textDefault,
            textValues,
        } = this.props;

        if (typeof text === 'object') {
            return text;
        }

        if (isMarkdown) {
            return (
                <FormattedMarkdownMessage
                    id={text}
                    defaultMessage={textDefault}
                    values={textValues}
                />
            );
        }

        return (
            <FormattedMessage
                id={text}
                values={textValues}
                defaultMessage={textDefault}
            />
        );
    };

    renderUntranslated = () => {
        const {isMarkdown, text} = this.props;
        if (isMarkdown) {
            if (typeof text === 'object') {
                return text;
            }
            const html = marked(text, {
                breaks: true,
                sanitize: true,
                renderer: new CustomRenderer(),
            });

            return <span dangerouslySetInnerHTML={{__html: html}}/>;
        }

        return <span>{text}</span>;
    };

    render() {
        return this.props.isTranslated ? this.renderTranslated() : this.renderUntranslated();
    }
}
