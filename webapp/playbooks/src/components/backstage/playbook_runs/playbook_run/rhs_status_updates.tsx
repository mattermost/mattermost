// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlaybookRun, StatusPostComplete} from 'src/types/playbook_run';

import StatusUpdateCard from './update_card';

interface Props {
    playbookRun: PlaybookRun;
    statusUpdates: StatusPostComplete[] | null;
}

const RHSStatusUpdates = ({playbookRun, statusUpdates}: Props) => {
    if (playbookRun.status_posts.length === 0 || statusUpdates === null) {
        return null;
    }

    return (
        <Container data-testid={'run-rhs-statusupdates'}>
            {statusUpdates.map((post) => (
                <Wrapper key={post.id}>
                    <StatusUpdateCard post={post}/>
                </Wrapper>
            ))}
        </Container>
    );
};

export default RHSStatusUpdates;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 25px;
`;

const Wrapper = styled.div`
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;
