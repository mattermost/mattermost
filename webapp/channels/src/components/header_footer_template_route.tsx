// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentType} from 'react';
import {Route} from 'react-router-dom';
import type {RouteProps} from 'react-router-dom';

const HeaderFooterTemplate = React.lazy(() => import('components/header_footer_template/header_footer_template'));
const LoggedIn = React.lazy(() => import('components/logged_in'));

interface Props extends RouteProps {
    component: ComponentType<any>;
}

export const HFTRoute = ({component: Component, ...rest}: Props) => (
    <Route
        {...rest}
        render={(props) => (
            <React.Suspense fallback={null}>
                <HeaderFooterTemplate {...props}>
                    <Component {...props}/>
                </HeaderFooterTemplate>
            </React.Suspense>
        )}
    />
);

export const LoggedInHFTRoute = ({component: Component, ...rest}: Props) => (
    <Route
        {...rest}
        render={(props) => (
            <React.Suspense fallback={null}>
                <LoggedIn {...props}>
                    <React.Suspense fallback={null}>
                        <HeaderFooterTemplate {...props}>
                            <Component {...props}/>
                        </HeaderFooterTemplate>
                    </React.Suspense>
                </LoggedIn>
            </React.Suspense>
        )}
    />
);
