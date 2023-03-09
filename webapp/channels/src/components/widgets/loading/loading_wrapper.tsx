// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingSpinner from './loading_spinner';

type Props = {
    loading: boolean;
    text: React.ReactNode;
    children: React.ReactNode;
}

export default class LoadingWrapper extends React.PureComponent<Props> {
    public static defaultProps: Props = {
        loading: true,
        text: null,
        children: null,
    }

    public render() {
        const {text, loading, children} = this.props;
        if (!loading) {
            return children;
        }

        return <LoadingSpinner text={text}/>;
    }
}
