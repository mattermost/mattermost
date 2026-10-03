// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {useAllowRetrospectiveAccess, usePlaybookAttributes} from 'src/hooks';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {Metric, PlaybookWithChecklist} from 'src/types/playbook';
import {SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import Metrics from 'src/components/backstage/playbook_edit/metrics/metrics';
import {BackstageSubheader, BackstageSubheaderDescription} from 'src/components/backstage/styles';
import MarkdownEdit from 'src/components/markdown_edit';
import {savePlaybook} from 'src/client';
import RetrospectiveIntervalSelector from 'src/components/backstage/playbook_editor/outline/inputs/retrospective_interval_selector';

export interface EditingMetric {
    index: number;
    metric: Metric;
}

// Convert GraphQL FullPlaybook to PlaybookWithChecklist format for legacy components
const convertToPlaybookWithChecklist = (playbook: FullPlaybook, propertyFields: any[] = []): PlaybookWithChecklist => {
    if (!playbook) {
        throw new Error('Playbook is required');
    }

    return {
        ...playbook,

        // Add missing calculated fields with default values
        num_stages: playbook.checklists?.length || 0,
        num_steps: playbook.checklists?.reduce((total, checklist) => total + (checklist.items?.length || 0), 0) || 0,
        num_runs: 0, // This would need to be fetched separately
        num_actions: 0, // This would need to be calculated
        last_run_at: 0, // This would need to be fetched separately
        active_runs: 0, // This would need to be fetched separately
        propertyFields: propertyFields || [],
    } as PlaybookWithChecklist;
};

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void;
}

const SectionRetrospective = ({playbook, refetch}: Props) => {
    const {formatMessage} = useIntl();
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const [curEditingMetric, setCurEditingMetric] = useState<EditingMetric | null>(null);
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const propertyFields = usePlaybookAttributes(playbook.id);
    const archived = playbook.delete_at !== 0;

    if (!retrospectiveAccess) {
        return null;
    }

    if (!playbook.retrospective_enabled) {
        return (<RetrospectiveTextContainer>
            <FormattedMessage defaultMessage='A retrospective is not expected.'/>
        </RetrospectiveTextContainer>);
    }

    return (
        <Card>
            <SidebarBlock id={'retrospective-reminder-interval'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective reminder interval'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Reminds the channel at a specified interval to fill out the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <RetrospectiveIntervalSelector
                    seconds={playbook.retrospective_reminder_interval_seconds}
                    onChange={(seconds) => {
                        updatePlaybook({
                            retrospectiveReminderIntervalSeconds: seconds,
                        });
                    }}
                    disabled={!playbook.retrospective_enabled || archived}
                />
            </SidebarBlock>
            <SidebarBlock id={'retrospective-metrics'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Key metrics'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Configure custom metrics to fill out with the retrospective report.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <Metrics
                    playbook={convertToPlaybookWithChecklist(playbook, propertyFields || [])} // TODO reduce prop scope to min-essentials
                    setPlaybook={async (update) => {
                        const playbookWithChecklist = convertToPlaybookWithChecklist(playbook, propertyFields || []);
                        await savePlaybook({...playbook, ...typeof update === 'function' ? update(playbookWithChecklist) : update}); // TODO replace with graphql / useUpdatePlaybook
                        refetch();
                    }}
                    curEditingMetric={curEditingMetric}
                    setCurEditingMetric={setCurEditingMetric}
                    disabled={!playbook.retrospective_enabled || archived}
                />
            </SidebarBlock>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective template'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Default text for the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <MarkdownEdit
                    className={'playbook_retrospective_template'}
                    placeholder={formatMessage({defaultMessage: 'Enter retrospective template'})}
                    value={playbook.retrospective_template}
                    onSave={(value: string) => {
                        updatePlaybook({
                            retrospectiveTemplate: value,
                        });
                    }}
                    disabled={!playbook.retrospective_enabled || archived}
                />
            </SidebarBlock>
        </Card>
    );
};

const RetrospectiveTextContainer = styled.div`
    padding: 0 8px;
`;

const Card = styled.div`
    display: flex;
    width: 100%;
    box-sizing: border-box;
    flex-direction: column;
    padding: 16px;
    padding-right: 20px;
    padding-left: 11px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0 0 0 / 0.08);
`;

export default SectionRetrospective;
