// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {matchPath, useLocation, useRouteMatch} from 'react-router-dom';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {GlobalState} from '@mattermost/types/store';
import {Theme, getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {useForceDocumentTitle} from 'src/hooks';
import {applyTheme} from 'src/components/backstage/css_utils';

import BackstageRHS from 'src/components/backstage/rhs/rhs';

import {ToastProvider} from './toast_banner';
import LHSNavigation from './lhs_navigation';
import MainBody from './main_body';

const BackstageContainer = styled.div`
    height: 100%;
    background: var(--center-channel-bg);
    overflow-y: auto;
`;

const Backstage = () => {
    const {pathname} = useLocation();

    const {url} = useRouteMatch();
    const noContainerScroll = matchPath<{playbookRunId?: string; playbookId?: string;}>(pathname, {
        path: [`${url}/runs/:playbookRunId`, `${url}/playbooks`],
    });

    const currentTheme = useSelector<GlobalState, Theme>(getTheme);
    useEffect(() => {
        // This class, critical for all the styling to work, is added by ChannelController,
        // which is not loaded when rendering this root component.
        document.body.classList.add('app__body');
        const root = document.getElementById('root');
        if (root) {
            root.className += ' channel-view';
        }

        applyTheme(currentTheme);
        return function cleanUp() {
            document.body.classList.remove('app__body');
        };
    }, [currentTheme]);

    useForceDocumentTitle('Playbooks');

    return (
        <BackstageContainer id={BackstageID}>
            <ToastProvider>
                <MainContainer $noContainerScroll={Boolean(noContainerScroll)}>
                    <LHSNavigation/>
                    <MainBody/>
                </MainContainer>
            </ToastProvider>
            <BackstageRHS/>
        </BackstageContainer>
    );
};

const MainContainer = styled.div<{$noContainerScroll: boolean}>`
    display: grid;
    grid-auto-flow: column;
    grid-template-columns: max-content auto;
    ${({$noContainerScroll}) => ($noContainerScroll ? css`
        height: 100%;
    ` : css`
        min-height: 100%;
    `)}
`;

export const BackstageID = 'playbooks-backstageRoot';

export default Backstage;

