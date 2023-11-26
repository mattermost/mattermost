// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ChangeEvent, useRef, useState, useEffect} from 'react';

import EditIcon from 'components/widgets/icons/fa_edit_icon';

import Constants from 'utils/constants';
import * as FileUtils from 'utils/file_utils';

import './team_picture_section.scss';

type Props = {
    src?: string | null;
    file?: File | null;
    teamName?: string;
    loadingPicture?: boolean;
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onRemove?: () => void;
    onSubmit?: (() => void) | null;
};

const TeamPictureSection = (props: Props) => {
    const selectInput = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<string>('');
    const [orientationStyles, setOrientationStyles] = useState<{transform: string; transformOrigin: string}>();

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
        if (props.file) {
            const imageStyles = {
                backgroundImage: 'url(' + image + ')',
                ...orientationStyles,
            };

            return (
                <div className={'team-img-preview'}>
                    <div className='img-preview__image'>
                        <div
                            alt={'team image preview'}
                            style={imageStyles}
                            className={'team-img-preview'}
                        />
                    </div>
                </div>
            );
        }
        if (props.src) {
            return <img src={props.src}/>;
        }
        return (
            <div className='team-picture-section__team-icon' >
                <span className='team-picture-section__team-name' >{props.teamName ? props.teamName.charAt(0).toUpperCase() + props.teamName?.charAt(1) : ''}</span>
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

    return (
        <div className='team-picture-section' >
            {teamImage()}
            {editIcon()}
        </div>
    );
};

export default TeamPictureSection;
