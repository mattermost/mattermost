// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage, {CustomRenderer} from 'components/formatted_markdown_message';

export default class SchemaText extends React.PureComponent {
    static propTypes = {
        isMarkdown: PropTypes.bool,
        isTranslated: PropTypes.bool,
        text: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.object,
        ]).isRequired,
        textDefault: PropTypes.string,
        textValues: PropTypes.object,
    };

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
        if (this.props.isMarkdown) {
            const html = marked(this.props.text, {
                breaks: true,
                sanitize: true,
                renderer: new CustomRenderer(),
            });

            return <span dangerouslySetInnerHTML={{__html: html}}/>;
        }

        return <span>{this.props.text}</span>;
    };

    render() {
        return this.props.isTranslated ? this.renderTranslated() : this.renderUntranslated();
    }
}
