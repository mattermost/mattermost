// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ChangeEvent, useRef, useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import EditIcon from 'components/widgets/icons/fa_edit_icon';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';

import Constants from 'utils/constants';
import * as FileUtils from 'utils/file_utils';
import {imageURLForTeam} from 'utils/utils';
import './team_picture_section.scss';

type Props = {
    team?: Team;
    file?: File | null;
    teamName?: string;
    disabled?: boolean;
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onRemove?: () => void;
    clientError?: BaseSettingItemProps['error'];
};

const TeamPictureSection = (props: Props) => {
    const selectInput = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<string>('');
    const [orientationStyles, setOrientationStyles] = useState<{transform: string; transformOrigin: string}>();
    const {formatMessage} = useIntl();

    const teamImageSource = imageURLForTeam(props.team || {} as Team);

    useEffect(() => {
        if (props.file) {
            setPicture(props.file);
        }
    }, [props.file]);

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
                    disabled={props.disabled}
                    type='file'
                    onChange={props.onFileChange}
                    aria-hidden={true}
                    tabIndex={-1}
                />
                <span
                    disabled={props.disabled}
                    onClick={handleInputFile}
                >
                    <EditIcon/>
                </span>
            </>
        );
    };

    const teamImage = () => {
        if (props.file) {
            const imageStyles = {
                backgroundImage: 'url(' + image + ')',
                backgroundSize: 'cover',
                backgroundRepeat: 'round',
                ...orientationStyles,
            };

            return (
                <div
                    alt='team image preview'
                    style={imageStyles}
                    className='team-img-preview'
                    onClick={handleInputFile}
                />
            );
        }
        if (teamImageSource) {
            return (
                <img
                    className='team-img-preview'
                    src={teamImageSource}
                    onClick={handleInputFile}
                />
            );
        }
        return (
            <div className='team-picture-section__team-icon' >
                <span
                    onClick={handleInputFile}
                    className='team-picture-section__team-name'
                >{props.teamName ? props.teamName.charAt(0).toUpperCase() + props.teamName?.charAt(1) : ''}</span>
            </div>
        );
    };

    const setPicture = (file: File) => {
        if (file) {
            const previewBlob = URL.createObjectURL(file);

            const reader = new FileReader();
            reader.onload = (e) => {
                const orientation = FileUtils.getExifOrientation(e.target!.result! as ArrayBuffer);
                const orientationStyles = FileUtils.getOrientationStyles(orientation);

                setImage(previewBlob);
                setOrientationStyles(orientationStyles);
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const removeImageButton = () => {
        if (props.file || teamImageSource) {
            return (
                <button
                    onClick={props.onRemove}
                    data-testid='removeImageButton'
                    className='style--none picture-setting-item__remove-button'
                >
                    <TrashCanOutlineIcon/>
                    {formatMessage({id: 'setting_picture.remove_image', defaultMessage: 'Remove image'})}
                </button>
            );
        }

        return null;
    };

    const teamPictureSection = (
        <>
            <div className='team-picture-section' >
                {teamImage()}
                {editIcon()}
            </div>
            {removeImageButton()}
        </>
    );

    return (
        <BaseSettingItem
            title={{id: 'setting_picture.title', defaultMessage: 'Team Icon'}}
            description={teamImageSource ? undefined : {
                id: 'setting_picture.help.profile',
                defaultMessage: 'Upload a picture in BMP, JPG, JPEG, or PNG format. Maximum file size: {max}',
                values: {max: '50MB'},
            }}
            content={teamPictureSection}
            className='picture-setting-item'
            error={props.clientError}
        />
    );
};

export default TeamPictureSection;
