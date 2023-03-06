import {useApolloClient} from '@apollo/client';
import React from 'react';
import styled from 'styled-components';

import PlaybooksSidebar, {playbookLHSQueryDocument} from 'src/components/sidebar/playbooks_sidebar';

const LHSContainer = styled.div`
    width: 240px;
    background-color: var(--sidebar-bg);

    display: flex;
    flex-direction: column;
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
