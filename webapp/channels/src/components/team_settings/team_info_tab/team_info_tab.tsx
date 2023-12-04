// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {ChangeEvent} from 'react';

import type {Team} from '@mattermost/types/teams';

import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import Constants from 'utils/constants';

import TeamDescriptionSection from './team_description_section';
import TeamNameSection from './team_name_section';
import TeamPictureSection from './team_picture_section';

import type {PropsFromRedux, OwnProps} from '.';

import './team_info_tab.scss';

const ACCEPTED_TEAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];
type Props = PropsFromRedux & OwnProps;

// todo sinan: LearnAboutTeamsLink check https://github.com/mattermost/mattermost/blob/af7bc8a4a90d8c4c17a82dc86bc898d378dec2ff/webapp/channels/src/components/team_general_tab/team_general_tab.tsx#L10
// todo sinan: think about to put name, description and image section into different files
// todo sinan: how to manage server errors
// todo sinan: fix tab changes when there is haveChanges
// todo sinan: check all css color var no -8 etc.
const InfoTab = (props: Props) => {
    const [name, setName] = useState<Team['display_name']>(props.team?.display_name ?? '');
    const [description, setDescription] = useState<Team['description']>(props.team?.description ?? '');
    const [serverError, setServerError] = useState<string>('');
    const [teamIconFile, setTeamIconFile] = useState<File | undefined>();
    const [loadingIcon, setLoadingIcon] = useState<boolean>(false);
    const [submitActive, setSubmitActive] = useState<boolean>(false);
    const [haveImageChanges, setHaveImageChanges] = useState<boolean>(false);
    const [imageClientError, setImageClientError] = useState<BaseSettingItemProps['error'] | undefined>();
    const [nameClientError, setNameClientError] = useState<BaseSettingItemProps['error'] | undefined>();
    const [descriptionClientError, setDescriptionClientError] = useState<BaseSettingItemProps['error'] | undefined>();

    const handleNameSubmit = async () => {
        // todo sinan handle case when there is no display name
        if (name?.trim() === props.team?.display_name) {
            return;
        }

        if (!name) {
            setNameClientError({id: 'general_tab.required', defaultMessage: 'This field is required'});
            return;
        } else if (name.length < Constants.MIN_TEAMNAME_LENGTH) {
            setNameClientError({
                id: 'general_tab.teamNameRestrictions',
                defaultMessage: 'Team Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description.',
                values: {min: Constants.MIN_TEAMNAME_LENGTH, max: Constants.MAX_TEAMNAME_LENGTH},
            });
            return;
        }
        const {error} = await props.actions.patchTeam({id: props.team?.id, display_name: name});
        if (error) {
            setServerError(error.message);
        }
    };

    const handleDescriptionSubmit = async () => {
        // todo sinan: this is called even only name or image changes
        if (description?.trim() === props.team?.description) {
            setDescriptionClientError({id: 'general_tab.chooseDescription', defaultMessage: 'Please choose a new description for your team'});
            return;
        }

        const data = {id: props.team?.id, description};
        const {error} = await props.actions.patchTeam(data);
        if (error) {
            setServerError(error.message);
        }
    };

    const handleTeamIconSubmit = async () => {
        if (!teamIconFile || !submitActive || !haveImageChanges) {
            return;
        }
        setLoadingIcon(true);
        setImageClientError(undefined);
        setServerError('');
        const {error} = await props.actions.setTeamIcon(props.team?.id || '', teamIconFile);
        setLoadingIcon(false);
        if (error) {
            setServerError(error.message);
        } else {
            setSubmitActive(false);
        }
    };

    const handleSaveChanges = async () => {
        await handleNameSubmit();
        await handleDescriptionSubmit();
        await handleTeamIconSubmit();
        setHaveImageChanges(false);
    };

    const handleCancel = () => {
        setName(props.team?.display_name ?? props.team?.name ?? '');
        setDescription(props.team?.description ?? '');
        setTeamIconFile(undefined);
        setHaveImageChanges(false);
        setImageClientError(undefined);
    };

    const handleTeamIconRemove = async () => {
        setLoadingIcon(true);
        setImageClientError(undefined);
        setServerError('');
        setTeamIconFile(undefined);
        setHaveImageChanges(false);

        const {error} = await props.actions.removeTeamIcon(props.team?.id || '');
        setLoadingIcon(false);
        if (error) {
            setServerError(error.message);
        } else {
            setSubmitActive(false);
        }
    };

    const updateTeamIcon = (e: ChangeEvent<HTMLInputElement>) => {
        if (e && e.target && e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (!ACCEPTED_TEAM_IMAGE_TYPES.includes(file.type)) {
                setImageClientError({id: 'general_tab.teamIconInvalidFileType', defaultMessage: 'Only BMP, JPG or PNG images may be used for team icons'});
            } else if (file.size > props.maxFileSize) {
                setImageClientError({id: 'general_tab.teamIconTooLarge', defaultMessage: 'Unable to upload team icon. File is too large.'});
            } else {
                setTeamIconFile(e.target.files[0]);
                setImageClientError(undefined);
                setSubmitActive(true);
                setHaveImageChanges(true);
            }
        } else {
            setTeamIconFile(undefined);
            setImageClientError({id: 'general_tab.teamIconError', defaultMessage: 'An error occurred while selecting the image.'});
        }
    };

    // todo sinan: check mobile view in Figma
    const modalSectionContent = (
        <div className='modal-info-tab-content' >
            <div className='name-description-container' >
                <TeamNameSection
                    name={name}
                    clientError={nameClientError}
                    handleNameChanges={(name) => setName(name)}
                />
                <TeamDescriptionSection
                    description={description}
                    clientError={descriptionClientError}
                    handleDescriptionChanges={(description) => setDescription(description)}
                />
            </div>
            <TeamPictureSection
                team={props.team}
                file={teamIconFile}
                loadingPicture={loadingIcon}
                onFileChange={updateTeamIcon}
                onRemove={handleTeamIconRemove}
                teamName={props.team?.display_name ?? props.team?.name}
                clientError={imageClientError}
            />
            {name !== props.team?.display_name || description !== props.team?.description || haveImageChanges ?
                <SaveChangesPanel
                    handleCancel={handleCancel}
                    handleSubmit={handleSaveChanges}
                    // errorState={true} // todo sinan pass if there is a server error
                /> : undefined}
        </div>
    );

    return <ModalSection content={modalSectionContent}/>;
};
export default InfoTab;
