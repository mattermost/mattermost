// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {useUpdateRun} from 'src/graphql/hooks';
import MarkdownEdit from 'src/components/markdown_edit';
import {PlaybookRun} from 'src/types/playbook_run';
import {Timestamp} from 'src/webapp_globals';
import {AnchorLinkTitle, Role} from 'src/components/backstage/playbook_runs/shared';
import {PAST_TIME_SPEC} from 'src/components/time_spec';

interface Props {
    id: string;
    playbookRun: PlaybookRun;
    role: Role,
}

const Summary = ({
    id, playbookRun, role,
}: Props) => {
    const {formatMessage} = useIntl();
    const updateRun = useUpdateRun(playbookRun.id);

    const title = formatMessage({defaultMessage: 'Summary'});
    const modifiedAt = (
        <Timestamp
            value={playbookRun.summary_modified_at}
            units={PAST_TIME_SPEC}
        />
    );

    const modifiedAtMessage = (
        <TimestampContainer>
            {formatMessage({defaultMessage: 'Last edited {timestamp}'}, {timestamp: modifiedAt})}
        </TimestampContainer>
    );

    const placeholder = role === Role.Participant ? formatMessage({defaultMessage: 'Add a run summary'}) : formatMessage({defaultMessage: 'There\'s no summary'});
    const disabled = (Role.Viewer === role || playbookRun.end_at > 0);

    return (
        <Container
            id={id}
            data-testid={'run-summary-section'}
        >
            <Header>
                <AnchorLinkTitle
                    title={title}
                    id={id}
                />
                {playbookRun.summary_modified_at > 0 && modifiedAtMessage}
            </Header>
            <MarkdownEdit
                disabled={disabled}
                placeholder={placeholder}
                value={playbookRun.summary}
                onSave={(value) => {
                    updateRun({summary: value});
                }}
            />
        </Container>
    );
};

export default Summary;

const Header = styled.div`
    display: flex;
    flex: 1;
    margin-bottom: 8px;
`;

const TimestampContainer = styled.div`
    flex-grow: 1;
    display: flex;
    white-space: pre-wrap;

    align-items: center;
    justify-content: flex-end;

    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
`;

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    margin-top: 24px;
`;
