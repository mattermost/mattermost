// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useSelector} from 'react-redux';
import {Route} from 'react-router-dom';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import AnnouncementBar from 'components/announcement_bar';
import BrandedHeaderFooterRoute from 'components/custom_branding/branded_header_footer_route';

import type {HeaderProps} from './header';

import './header_footer_route.scss';

const Header = React.lazy(() => import('./header'));
const Footer = React.lazy(() => import('./footer'));

export type CustomizeHeaderType = (props: HeaderProps) => void;

const LoggedIn = React.lazy(() => import('components/logged_in'));

export type HFRouteProps = {
    path?: string;
    component: React.ComponentType<{onCustomizeHeader?: CustomizeHeaderType}>;
};

export const HFRoute = ({path, component: Component}: HFRouteProps) => {
    const [headerProps, setHeaderProps] = useState<HeaderProps>({});
    const {EnableCustomBrand, CustomBrandShowFooter} = useSelector(getConfig);

    const customizeHeader: CustomizeHeaderType = useCallback((props) => {
        setHeaderProps(props);
    }, []);

    return (
        <Route
            path={path}
            render={() => (
                <>
                    <React.Suspense fallback={null}>
                        <AnnouncementBar/>
                    </React.Suspense>
                    <div className='header-footer-route'>
                        <BrandedHeaderFooterRoute className='header-footer-route-container'>
                            <React.Suspense fallback={null}>
                                <Header {...headerProps}/>
                            </React.Suspense>
                            <React.Suspense fallback={null}>
                                <Component onCustomizeHeader={customizeHeader}/>
                            </React.Suspense>
                            <React.Suspense fallback={null}>
                                {(!EnableCustomBrand || CustomBrandShowFooter !== 'false') && <Footer/>}
                            </React.Suspense>
                        </BrandedHeaderFooterRoute>
                    </div>
                </>
            )}
        />
    );
};

export const LoggedInHFRoute = ({component: Component, ...rest}: HFRouteProps) => (
    <Route
        {...rest}
        render={(props) => (
            <React.Suspense fallback={null}>
                <LoggedIn {...props}>
                    <React.Suspense fallback={null}>
                        <HFRoute
                            component={Component}
                            {...props}
                        />
                    </React.Suspense>
                </LoggedIn>
            </React.Suspense>
        )}
    />
);
