// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from "react";
import { Route, RouteProps } from "react-router-dom";

const HeaderFooterTemplate = React.lazy(
    () => import("components/header_footer_template")
);
const LoggedIn = React.lazy(() => import("components/logged_in"));

export const HFTRoute = ({ component: Component, ...rest }: RouteProps) => (
    <Route
        {...rest}
        render={(props) => (
            <React.Suspense fallback={null}>
                <HeaderFooterTemplate {...props}>
                    {Component && <Component {...props} />}
                </HeaderFooterTemplate>
            </React.Suspense>
        )}
    />
);

export const LoggedInHFTRoute = ({
    component: Component,
    ...rest
}: RouteProps) => (
    <Route
        {...rest}
        render={(props) => (
            <React.Suspense fallback={null}>
                <LoggedIn {...props}>
                    <React.Suspense fallback={null}>
                        <HeaderFooterTemplate {...props}>
                            {Component && <Component {...props} />}
                        </HeaderFooterTemplate>
                    </React.Suspense>
                </LoggedIn>
            </React.Suspense>
        )}
    />
);
