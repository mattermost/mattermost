// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    onHeightChange: () => void;
    children?: React.ReactNode;
};

/** Re-run ShowMore overflow measurement when footer content mounts or updates. */
export default class MessageBodyFooterMountNotify extends React.PureComponent<Props> {
    componentDidMount() {
        this.props.onHeightChange();
    }

    componentDidUpdate() {
        this.props.onHeightChange();
    }

    render() {
        return this.props.children ?? null;
    }
}
