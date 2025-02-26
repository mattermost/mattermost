// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy} from 'react';
import type {RouteComponentProps} from 'react-router-dom';
import {Route} from 'react-router-dom';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {makeAsyncComponent} from 'components/async_load';
import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import LoggedIn from 'components/logged_in';

const OnBoardingTaskList = makeAsyncComponent('OnboardingTaskList', lazy(() => import('components/onboarding_tasklist')));

type Props = {
    component: React.ComponentType<RouteComponentProps<any>>;
    path: string | string[];
    theme?: Theme; // the routes that send the theme are the ones that will actually need to show the onboarding tasklist
};

export default function LoggedInRoute(props: Props) {
    const {component: Component, theme, ...rest} = props;

    return (
        <Route
            {...rest}
            render={(routeProps) => (
                <LoggedIn {...routeProps}>
                    {theme && (
                        <CompassThemeProvider theme={theme}>
                            <OnBoardingTaskList/>
                        </CompassThemeProvider>
                    )}
                    <Component {...(routeProps)}/>
                </LoggedIn>
            )}
        />
    );
}
