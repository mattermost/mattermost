// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage, {CustomRenderer} from 'components/formatted_markdown_message';

type Props = {
    isMarkdown?: boolean;
    text: string | MessageDescriptor | JSX.Element;
    textValues?: Record<string, string | (() => React.ReactNode)>;
}

const SchemaText = ({
    isMarkdown,
    text,
    textValues,
}: Props) => {
    if (typeof text === 'string') {
        if (isMarkdown) {
            const html = marked(text, {
                breaks: true,
                sanitize: true,
                renderer: new CustomRenderer(),
            });

            return <span dangerouslySetInnerHTML={{__html: html}}/>;
        }

        return <span>{text}</span>;
    }

    if ('id' in text) {
        if (isMarkdown) {
            return (
                <FormattedMarkdownMessage
                    {...text}
                    values={textValues}
                />
            );
        }

        return (
            <FormattedMessage
                {...text}
                values={textValues}
            />
        );
    }

    return text as JSX.Element;
};

export default SchemaText;
