// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {groupHealthFindingsByArea, groupHealthFindingsBySection} from 'mattermost-redux/utils/health_utils';

import {orderAreas} from './area';
import AreaAccordion from './area_accordion';
import FindingSection from './finding_section';
import type {RowState} from './finding_section';
import type {GroupBy} from './group_by_control';

type FindingGroupsProps = RowState & {
    findings: HealthFinding[];
    groupBy: GroupBy;
    expandAll: boolean;
};

const FindingGroups = ({findings, groupBy, expandAll, ...rowState}: FindingGroupsProps) => {
    if (groupBy === 'category') {
        const byArea = groupHealthFindingsByArea(findings);
        return (
            <>
                {orderAreas(byArea).map((area) => (
                    <AreaAccordion
                        key={area}
                        area={area}
                        findings={byArea[area]}
                        expandAll={expandAll}
                        {...rowState}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            {groupHealthFindingsBySection(findings).map(({section, findings: sectionFindings}) => (
                <FindingSection
                    key={section}
                    section={section}
                    findings={sectionFindings}
                    {...rowState}
                />
            ))}
        </>
    );
};

export default FindingGroups;
