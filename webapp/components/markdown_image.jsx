// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PureComponent} from 'react';

import {postListScrollChange} from 'actions/global_actions.jsx';

export default class MarkdownImage extends PureComponent {
    handleLoad = () => {
        postListScrollChange();
    }

    render() {
        const props = {...this.props};
        props.onLoad = this.handleLoad;

        return <img {...props}/>;
    }
}
