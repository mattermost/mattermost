// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './team_picture_section.scss';

type Props = {
    src?: string | null;
    file?: File | null;
    teamName?: string;
};

const TeamPictureSection = (props: Props) => {
    const teamImage = () => {
        if (props.src) {
            return <img src={props.src}/>;
        }
        return (
            <div className='team-picture-section__team-icon' >
                <span className='team-picture-section__team-name' >{props.teamName ? props.teamName.charAt(0).toUpperCase() + props.teamName?.charAt(1) : ''}</span>
            </div>
        );
    };

    return (
        <div className='team-picture-section' >
            {teamImage()}
        </div>
    );
};

export default TeamPictureSection;
