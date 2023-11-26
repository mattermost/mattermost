// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ChangeEvent, useRef, useEffect} from 'react';

import EditIcon from 'components/widgets/icons/fa_edit_icon';

import './team_picture_section.scss';
import Constants from 'utils/constants';

type Props = {
    src?: string | null;
    teamName?: string;
    loadingPicture?: boolean;
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

const TeamPictureSection = (props: Props) => {
    const selectInput = useRef<HTMLInputElement>(null);
    const handleInputFile = () => {
        if (selectInput.current) {
            selectInput.current.value = '';
            selectInput.current.click();
        }
    };

    const editIcon = () => {
        return (
            <>
                <input
                    data-testid='uploadPicture'
                    ref={selectInput}
                    className='hidden'
                    accept={Constants.ACCEPT_STATIC_IMAGE}
                    disabled={props.loadingPicture}
                    type='file'
                    onChange={props.onFileChange}
                    aria-hidden={true}
                    tabIndex={-1}
                />
                <span
                    disabled={props.loadingPicture}
                    onClick={handleInputFile}
                >
                    <EditIcon/>
                </span>
            </>
        );
    };

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
            {editIcon()}
        </div>
    );
};

export default TeamPictureSection;
