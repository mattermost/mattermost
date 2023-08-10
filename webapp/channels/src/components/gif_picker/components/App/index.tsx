// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {connect} from 'react-redux';

import {saveAppProps} from 'mattermost-redux/actions/gifs';

import Header from 'components/gif_picker/components/Header';

import type {appProps} from 'components/gif_picker/gif_picker';
import type {ReactNode} from 'react';

const mapDispatchToProps = ({
    saveAppProps,
});

type Props = {
    appProps: typeof appProps;
    action: string;
    onCategories: () => void;
    onSearch?: () => void;
    onTrending: () => void;
    children?: ReactNode;
    saveAppProps?: (appProps: Props['appProps']) => void;
    defaultSearchText?: string;
    handleSearchTextChange: (text: string) => void;
}

export class App extends PureComponent<Props> {
    constructor(props: Props) {
        super(props);
        const {appProps} = this.props;
        this.props.saveAppProps?.(appProps);
    }

    render() {
        const {
            appProps,
            action,
            onCategories,
            onSearch,
            onTrending,
            children,
            defaultSearchText,
            handleSearchTextChange,
        } = this.props;
        const appClassName = 'main-container ' + (appProps.appClassName || '');
        return (
            <div className={appClassName}>
                <Header
                    appProps={appProps}
                    action={action}
                    onCategories={onCategories}
                    onSearch={onSearch}
                    onTrending={onTrending}
                    defaultSearchText={defaultSearchText}
                    handleSearchTextChange={handleSearchTextChange}
                />
                <div className='component-container'>
                    {children}
                </div>
            </div>
        );
    }
}

export default connect(null, mapDispatchToProps)(App);
