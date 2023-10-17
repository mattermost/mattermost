// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {CheckIcon} from '@mattermost/compass-icons/components';

import Accordion from 'components/common/accordion/accordion';
import type {AccordionItemType} from 'components/common/accordion/accordion';
import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import ChipsList from './chips_list';
import type {ChipsInfoType} from './chips_list';
import CtaButtons from './cta_buttons';
import useMetricsData from './dashboard.data';
import {ItemStatus} from './dashboard.type';
import OverallScore from './overall-score';

import type {Props} from '../admin_console';

import './dashboard.scss';

const AccordionItem = styled.div`
    padding: 12px;
    &:last-child {
        border-bottom: none;
    }
    h5 {
        display: inline-flex;
        align-items: center;
        font-weight: bold;
    }
`;

const successIcon = (
    <div className='success'>
        <CheckIcon
            size={20}
            color={'var(--sys-online-indicator)'}
        />
    </div>
);

const WorkspaceOptimizationDashboard = (props: Props) => {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const accordionItemsData: AccordionItemType[] | undefined = data && Object.entries(data).filter(([_, y]) => !y.hide).map(([accordionKey, accordionData]) => {
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
                    <AccordionItem
                        key={`${accordionKey}-item_${item.id}`}
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
                    </AccordionItem>
                ));

                accordionDataChips[item.status] += 1;
                overallScoreChips[item.status] += 1;
            }
        });
        const {title, description, descriptionOk, icon} = accordionData;
        return {
            title,
            description: items.length === 0 ? descriptionOk : description,
            icon: items.length === 0 ? successIcon : icon,
            items,
            extraContent: (
                <ChipsList
                    chipsData={accordionDataChips}
                    hideCountZeroChips={true}
                />
            ),
        };
    });

    return loading || !accordionItemsData ? <LoadingScreen/> : (
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
                <Accordion
                    accordionItemsData={accordionItemsData}
                    expandMultiple={true}
                />
            </div>
        </div>
    );
};

export default WorkspaceOptimizationDashboard;
