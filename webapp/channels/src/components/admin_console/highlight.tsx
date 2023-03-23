// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Mark from 'mark.js';
import debounce from 'lodash/debounce';

type Props = {
    filter: string;
    children: React.ReactNode;
}

export default class Highlight extends React.PureComponent<Props> {
    private markInstance?: Mark;
    private ref: React.RefObject<HTMLDivElement>;

    public constructor(props: Props) {
        super(props);
        this.ref = React.createRef<HTMLDivElement>();
    }

    private redrawHighlight = debounce(() => {
        if (this.markInstance) {
            this.markInstance.unmark();
        }

        if (!this.props.filter) {
            return;
        }

        if (!this.ref.current) {
            return;
        }

        // Is necesary to recreate the instances to get again the DOM elements after the re-render
        this.markInstance = new Mark(this.ref.current);
        this.markInstance.mark(this.props.filter, {accuracy: 'complementary'});
    }, 100, {leading: true, trailing: true});

    public render() {
        // Run on next frame
        setTimeout(this.redrawHighlight, 0);
        return (
            <div ref={this.ref}>
                {this.props.children}
            </div>
        );
    }
}
