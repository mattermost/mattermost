// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {Children, ReactNode, useState} from 'react';

import {useIntl} from 'react-intl';

import {PlaybookWithChecklist} from 'src/types/playbook';
import MarkdownEdit from 'src/components/markdown_edit';
import ChecklistList from 'src/components/checklist/checklist_list';
import {usePlaybookViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookViewTarget} from 'src/types/telemetry';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import PlaybookActionsModal from 'src/components/playbook_actions_modal';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';
import {useAllowRetrospectiveAccess} from 'src/hooks';

import StatusUpdates from './section_status_updates';
import Retrospective from './section_retrospective';
import Actions from './section_actions';
import ScrollNavBase from './scroll_nav';
import Section from './section';

interface Props {
    playbook: Loaded<FullPlaybook>;
    refetch: () => void;
}

type StyledAttrs = {className?: string};

const Outline = ({playbook, refetch}: Props) => {
    usePlaybookViewTelemetry(PlaybookViewTarget.Outline, playbook.id);

    const {formatMessage} = useIntl();
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const archived = playbook.delete_at !== 0;
    const [checklistCollapseState, setChecklistCollapseState] = useState<Record<number, boolean>>({});

    const onChecklistCollapsedStateChange = (checklistIndex: number, state: boolean) => {
        setChecklistCollapseState({
            ...checklistCollapseState,
            [checklistIndex]: state,
        });
    };
    const onEveryChecklistCollapsedStateChange = (state: Record<number, boolean>) => {
        setChecklistCollapseState(state);
    };

    const toggleStatusUpdate = () => {
        if (archived) {
            return;
        }
        updatePlaybook({
            statusUpdateEnabled: !playbook.status_update_enabled,
            webhookOnStatusUpdateEnabled: !playbook.status_update_enabled,
            broadcastEnabled: !playbook.status_update_enabled,
        });
    };

    const toggleRetrospective = () => {
        if (archived || !retrospectiveAccess) {
            return;
        }
        updatePlaybook({
            retrospectiveEnabled: !playbook.retrospective_enabled,
        });
    };

    return (
        <Sections
            playbookId={playbook.id}
            data-testid='preview-content'
        >
            <Section
                id={'summary'}
                title={formatMessage({defaultMessage: 'Summary'})}
            >
                <MarkdownEdit
                    disabled={archived}
                    placeholder={formatMessage({defaultMessage: 'Add a run summary template…'})}
                    value={(playbook.run_summary_template_enabled && playbook.run_summary_template) || ''}
                    onSave={(runSummaryTemplate) => {
                        updatePlaybook({
                            runSummaryTemplate,
                            runSummaryTemplateEnabled: Boolean(runSummaryTemplate.trim()),
                        });
                    }}
                />
            </Section>
            <Section
                id={'status-updates'}
                title={formatMessage({defaultMessage: 'Status Updates'})}
                hasSubtitle={true}
                hoverEffect={true}
                headerRight={(
                    <HoverMenuContainer data-testid={'status-update-toggle'}>
                        <Toggle
                            disabled={archived}
                            isChecked={playbook.status_update_enabled}
                            onChange={toggleStatusUpdate}
                        />
                    </HoverMenuContainer>
                )}
                onHeaderClick={toggleStatusUpdate}
            >
                <StatusUpdates
                    playbook={playbook}
                />
            </Section>
            <Section
                id={'checklists'}
                title={formatMessage({defaultMessage: 'Tasks'})}
            >
                <ChecklistList
                    playbook={playbook}
                    isReadOnly={false}
                    checklistsCollapseState={checklistCollapseState}
                    onChecklistCollapsedStateChange={onChecklistCollapsedStateChange}
                    onEveryChecklistCollapsedStateChange={onEveryChecklistCollapsedStateChange}
                />
            </Section>
            <Section
                id={'retrospective'}
                title={formatMessage({defaultMessage: 'Retrospective'})}
                hasSubtitle={retrospectiveAccess && !playbook.retrospective_enabled}
                hoverEffect={true}
                headerRight={(
                    <HoverMenuContainer>
                        <Toggle
                            disabled={archived || !retrospectiveAccess}
                            isChecked={playbook.retrospective_enabled}
                            onChange={toggleRetrospective}
                        />
                    </HoverMenuContainer>
                )}
                onHeaderClick={toggleRetrospective}
            >
                <Retrospective
                    playbook={playbook}
                    refetch={refetch}
                />
            </Section>
            <Section
                id={'actions'}
                title={formatMessage({defaultMessage: 'Actions'})}
            >
                <Actions
                    playbook={playbook}
                />
            </Section>
            <PlaybookActionsModal
                playbook={playbook}
                readOnly={false}
            />
        </Sections>
    );
};

export const ScrollNav = styled(ScrollNavBase)`
`;

type SectionItem = {id: string, title: string};

type SectionsProps = {
    playbookId: PlaybookWithChecklist['id'];
    children: ReactNode;
}

const SectionsImpl = ({
    playbookId,
    children,
    className,
}: SectionsProps & StyledAttrs) => {
    const items = Children.toArray(children).reduce<Array<SectionItem>>((result, node) => {
        if (
            React.isValidElement(node) &&
            node.props.id &&
            node.props.title &&
            node.props.children
        ) {
            const {id, title} = node.props;
            result.push({id, title});
        }
        return result;
    }, []);

    return (
        <>
            <ScrollNav
                playbookId={playbookId}
                items={items}
            />
            <div className={className}>
                {children}
            </div>
        </>
    );
};

export const Sections = styled(SectionsImpl)`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    margin-bottom: 40px;
    padding: 2rem;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 8px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
    background: var(--center-channel-bg);
`;

const HoverMenuContainer = styled.div`
    display: flex;
    align-items: center;
    padding: 0px 8px;
    position: relative;
    height: 32px;
    right: 1px;
`;

export default Outline;
