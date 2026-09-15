// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useApolloClient} from '@apollo/client';
import React from 'react';
import styled from 'styled-components';

import PlaybooksSidebar, {playbookLHSQueryDocument} from 'src/components/sidebar/playbooks_sidebar';

const LHSContainer = styled.div`
    display: flex;
    width: 240px;
    flex-direction: column;
    background-color: var(--sidebar-bg);
`;

const LHSNavigation = () => {
    return (
        <LHSContainer data-testid='lhs-navigation'>
            <PlaybooksSidebar/>
        </LHSContainer>
    );
};

export const useLHSRefresh = () => {
    const apolloClient = useApolloClient();

    const refreshLists = () => {
        apolloClient.refetchQueries({
            include: [playbookLHSQueryDocument],
        });
    };

    return refreshLists;
};

export default LHSNavigation;
