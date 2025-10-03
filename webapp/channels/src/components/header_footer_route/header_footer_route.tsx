// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {Route} from 'react-router-dom';

import AnnouncementBar from 'components/announcement_bar';

import type {HeaderProps} from './header';

import './header_footer_route.scss';

const Header = React.lazy(() => import('./header'));
const Footer = React.lazy(() => import('./footer'));

export type CustomizeHeaderType = (props: HeaderProps) => void;

export type HFRouteProps = {
    path: string;
    component: React.ComponentType;
};

export const HFRoute = ({path, component}: HFRouteProps) => {
    const [headerProps, setHeaderProps] = useState<HeaderProps>({});

    const customizeHeader: CustomizeHeaderType = useCallback((props) => {
        setHeaderProps(props);
    }, []);

    const Component = component as React.ComponentType<{onCustomizeHeader?: CustomizeHeaderType}>;

    return (
        <Route
            path={path}
            render={() => (
                <>
                    <React.Suspense fallback={null}>
                        <AnnouncementBar/>
                    </React.Suspense>
                    <div className='header-footer-route'>
                        <div className='header-footer-route-container'>
                            <React.Suspense fallback={null}>
                                <Header {...headerProps}/>
                            </React.Suspense>
                            <React.Suspense fallback={null}>
                                <Component onCustomizeHeader={customizeHeader}/>
                            </React.Suspense>
                            <React.Suspense fallback={null}>
                                <Footer/>
                            </React.Suspense>
                        </div>
                    </div>
                </>
            )}
        />
    );
};
