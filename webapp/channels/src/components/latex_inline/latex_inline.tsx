// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {KatexOptions} from 'katex';

type Katex = typeof import('katex');

type Props = {
    content: string;
    enableInlineLatex: boolean;
};

type State = {
    katex?: Katex;
}

export default class LatexInline extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            katex: undefined,
        };
    }

    componentDidMount(): void {
        import('katex').then((katex) => {
            this.setState({katex: katex.default});
        });
    }

    render(): React.ReactNode {
        if (!this.props.enableInlineLatex || this.state.katex === undefined) {
            return (
                <span
                    className='post-body--code inline-tex'
                >
                    {'$' + this.props.content + '$'}
                </span>
            );
        }

        try {
            const katexOptions: KatexOptions = {
                throwOnError: false,
                displayMode: false,
                maxSize: 200,
                maxExpand: 100,
                fleqn: true,
            };

            const html = this.state.katex.renderToString(this.props.content, katexOptions);

            return (
                <span
                    className='post-body--code inline-tex'
                    dangerouslySetInnerHTML={{__html: html}}
                />
            );
        } catch (e) {
            return (
                <span
                    className='post-body--code inline-tex'
                >
                    <FormattedMessage
                        id='katex.error'
                        defaultMessage="Couldn't compile your Latex code. Please review the syntax and try again."
                    />
                </span>
            );
        }
    }
}
