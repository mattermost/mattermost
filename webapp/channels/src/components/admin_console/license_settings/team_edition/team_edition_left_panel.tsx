// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './team_edition.scss';
export interface TeamEditionProps {
    openEELicenseModal: () => void;
    currentPlan: JSX.Element;
}

const TeamEdition: React.FC<TeamEditionProps> = ({openEELicenseModal, currentPlan}: TeamEditionProps) => {
    const title = 'Team Edition';
    return (
        <div className='TeamEditionLeftPanel'>
            <div className='title'>{title}</div>
            <div className='currentPlanLegend'>
                {currentPlan}
            </div>
            <hr/>
            <div>
                <p>{'When using Mattermost Team Edition, the software is offered under a Mattermost MIT Compiled License. See MIT-COMPILED-LICENSE.md in your root install directory for details.'}</p>
                <p>
                    {'When using Mattermost Enterprise Edition, the software is offered under a commercial license. See '}
                    <a
                        role='button'
                        onClick={openEELicenseModal}
                        className='openEELicenseModal'
                    >
                        {'here'}
                    </a>
                    {' for “Enterprise Edition License” for details.'}
                </p>
                <p>{'See NOTICE.txt for information about open source software used in the system.'}</p>
            </div>
        </div>
    );
};

export default TeamEdition;
