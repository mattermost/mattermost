// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {AdminPanelExpandedState} from '@mattermost/compass-ui/components/admin-panel';
import {Icon} from '@mattermost/compass-ui/components/icon';

import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import ChipsList from './chips_list';
import type {ChipsInfoType} from './chips_list';
import CtaButtons from './cta_buttons';
import useMetricsData from './dashboard.data';
import {ItemStatus} from './dashboard.type';
import OverallScore from './overall-score';

import type {Props} from '../admin_console';

import './dashboard.scss';

const successIcon = (
    <Icon glyph={<CheckIcon/>}/>
);

type SectionPanelProps = {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    items: React.ReactNode[];
    chips: React.ReactNode;
    expandLabel: string;
    collapseLabel: string;
};

const WorkspaceOptimizationSectionPanel = ({
    id,
    title,
    description,
    icon,
    items,
    chips,
    expandLabel,
    collapseLabel,
}: SectionPanelProps) => {
    const hasItems = items.length > 0;
    const [expandedState, setExpandedState] = useState<AdminPanelExpandedState>('collapsed');

    // Compass only toggles via the header chevron. Match the former Accordion
    // cards: clicking anywhere on the header opens/closes the section.
    const handlePanelClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (!hasItems) {
            return;
        }

        const target = event.target as HTMLElement | null;
        const header = event.currentTarget.querySelector('header');
        if (!target || !header?.contains(target)) {
            return;
        }

        // Expand IconButton already calls onExpandedStateChange — avoid a double toggle.
        if (target.closest('[aria-expanded]')) {
            return;
        }

        setExpandedState((current) => (current === 'expanded' ? 'collapsed' : 'expanded'));
    }, [hasItems]);

    return (
        <AdminPanel
            id={id}
            className={classNames('WorkspaceOptimizationDashboard__section', {
                'WorkspaceOptimizationDashboard__section--success': !hasItems,
                'WorkspaceOptimizationDashboard__section--header-only': !hasItems,
                'WorkspaceOptimizationDashboard__section--expandable': hasItems,
            })}
            title={title}
            subtitle={description}
            iconLeft={true}
            leadingIcon={hasItems ? icon : successIcon}
            button={hasItems ? chips : undefined}
            expandable={hasItems}
            expandedState={hasItems ? expandedState : undefined}
            onExpandedStateChange={hasItems ? setExpandedState : undefined}
            expandLabel={expandLabel}
            collapseLabel={collapseLabel}
            onClick={handlePanelClick}
        >
            {hasItems ? items : undefined}
        </AdminPanel>
    );
};

const WorkspaceOptimizationDashboard = (props: Props) => {
    const {formatMessage} = useIntl();
    const {data, loading} = useMetricsData(props.config);

    const overallScoreChips: ChipsInfoType = {
        [ItemStatus.INFO]: 0,
        [ItemStatus.WARNING]: 0,
        [ItemStatus.ERROR]: 0,
    };

    const overallScore = {
        max: 0,
        current: 0,
    };

    const expandLabel = formatMessage({
        id: 'admin.panel.expand',
        defaultMessage: 'Expand section',
    });
    const collapseLabel = formatMessage({
        id: 'admin.panel.collapse',
        defaultMessage: 'Collapse section',
    });

    const sectionPanels = data && Object.entries(data).filter(([, section]) => !section.hide).map(([accordionKey, accordionData]) => {
        const accordionDataChips: ChipsInfoType = {
            [ItemStatus.INFO]: 0,
            [ItemStatus.WARNING]: 0,
            [ItemStatus.ERROR]: 0,
        };
        const items: React.ReactNode[] = [];
        accordionData.items.forEach((item) => {
            if (item.status === undefined) {
                return;
            }

            // add the items impact to the overall score here
            overallScore.max += item.scoreImpact;
            overallScore.current += item.scoreImpact * item.impactModifier;

            // chips will only be displayed for info aka Success, warning and error aka Problems
            if (item.status !== ItemStatus.OK && item.status !== ItemStatus.NONE) {
                items.push((
                    <div
                        key={`${accordionKey}-item_${item.id}`}
                        className='WorkspaceOptimizationDashboard__item'
                    >
                        <h5>
                            <i
                                className={classNames(`icon ${item.status}`, {
                                    'icon-alert-outline': item.status === ItemStatus.WARNING,
                                    'icon-alert-circle-outline': item.status === ItemStatus.ERROR,
                                    'icon-information-outline': item.status === ItemStatus.INFO,
                                })}
                            />
                            {item.title}
                        </h5>
                        <p>{item.description}</p>
                        <CtaButtons
                            learnMoreLink={item.infoUrl}
                            learnMoreText={item.infoText}
                            actionLink={item.configUrl}
                            actionText={item.configText}
                        />
                    </div>
                ));

                accordionDataChips[item.status] += 1;
                overallScoreChips[item.status] += 1;
            }
        });
        const {title, description, descriptionOk, icon} = accordionData;
        return (
            <WorkspaceOptimizationSectionPanel
                key={accordionKey}
                id={`workspace-optimization-${accordionKey}`}
                title={title}
                description={items.length === 0 ? descriptionOk : description}
                icon={icon}
                items={items}
                chips={(
                    <ChipsList
                        chipsData={accordionDataChips}
                        hideCountZeroChips={true}
                    />
                )}
                expandLabel={expandLabel}
                collapseLabel={collapseLabel}
            />
        );
    });

    return loading || !sectionPanels ? <LoadingScreen/> : (
        <div className='WorkspaceOptimizationDashboard wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    id={'admin.reporting.workspace_optimization.title'}
                    defaultMessage='Workspace Optimization'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <OverallScore
                    chips={
                        <ChipsList
                            chipsData={overallScoreChips}
                            hideCountZeroChips={false}
                        />
                    }
                    chartValue={Math.floor((overallScore.current / overallScore.max) * 100)}
                />
                <div className='WorkspaceOptimizationDashboard__sections'>
                    {sectionPanels}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceOptimizationDashboard;
