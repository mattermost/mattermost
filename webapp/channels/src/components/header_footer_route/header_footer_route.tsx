// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useSelector} from 'react-redux';
import {Route} from 'react-router-dom';
import styled from 'styled-components';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import AnnouncementBar from 'components/announcement_bar';

import type {HeaderProps} from './header';

import './header_footer_route.scss';

const Header = React.lazy(() => import('./header'));
const Footer = React.lazy(() => import('./footer'));

export type CustomizeHeaderType = (props: HeaderProps) => void;

export type HFRouteProps = {
    path: string;
    component: React.ComponentType<{onCustomizeHeader?: CustomizeHeaderType}>;
};

const StyledHeaderFooterRouteContainer = styled.div<{className: string; background: string; color: string; backgroundImage: string | null}>`
    &&& {
        background: ${(props) => props.background};
        color: ${(props) => props.color};
        background-image: ${(props) => `url(${props.backgroundImage})`};
        background-position: "center";
        background-repeat: "no-repeat";
        background-size: "cover";
    }
`;

const HeaderFooterRouteContainer = (props: {children: React.ReactNode}) => {
    const {
        EnableCustomBrand,
        CustomBrandColorBackground,
        CustomBrandColorText,
        CustomBrandHasBackground,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <StyledHeaderFooterRouteContainer
                className='header-footer-route-container'
                background={CustomBrandColorBackground || ''}
                color={CustomBrandColorText || ''}
                backgroundImage={CustomBrandHasBackground === 'true' ? Client4.getCustomBackgroundUrl('0') : null}
            >
                {props.children}
            </StyledHeaderFooterRouteContainer>);
    }
    return <div className='header-footer-route-container'>{props.children}</div>;
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
                        <HeaderFooterRouteContainer>
                            <React.Suspense fallback={null}>
                                <Header {...headerProps}/>
                            </React.Suspense>
                            <React.Suspense fallback={null}>
                                <Component onCustomizeHeader={customizeHeader}/>
                            </React.Suspense>
                            <React.Suspense fallback={null}>
                                {!EnableCustomBrand || CustomBrandShowFooter !== 'true' && <Footer/>}
                            </React.Suspense>
                        </HeaderFooterRouteContainer>
                    </div>
                </>
            )}
        />
    );
};
