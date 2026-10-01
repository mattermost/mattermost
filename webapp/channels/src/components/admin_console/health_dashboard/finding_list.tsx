// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useId} from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {AreaIcon, AreaLabel} from './area';
import FindingRow from './finding_row';

type Props = {
    area: string;
    findings: HealthFinding[];
};

const FindingList = ({area, findings}: Props) => {
    const headingId = useId();

    return (
        <section
            className='HealthDashboard__section'
            aria-labelledby={headingId}
        >
            <h3
                id={headingId}
                className='HealthDashboard__sectionTitle'
            >
                <AreaIcon area={area}/>
                <AreaLabel area={area}/>
                <span className='HealthDashboard__sectionCount'>{findings.length}</span>
            </h3>
            <ul className='HealthDashboard__findings'>
                {findings.map((finding) => (
                    <FindingRow
                        key={finding.fingerprint}
                        finding={finding}
                    />
                ))}
            </ul>
        </section>
    );
};

export default FindingList;
