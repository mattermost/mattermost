// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {ChangeEvent} from 'react';
import {useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import Constants from 'utils/constants';

import TeamDescriptionSection from './team_description_section';
import TeamNameSection from './team_name_section';
import TeamPictureSection from './team_picture_section';

import type {PropsFromRedux, OwnProps} from '.';

import './team_info_tab.scss';

const ACCEPTED_TEAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];
type Props = PropsFromRedux & OwnProps;

// todo sinan: LearnAboutTeamsLink check https://github.com/mattermost/mattermost/blob/af7bc8a4a90d8c4c17a82dc86bc898d378dec2ff/webapp/channels/src/components/team_general_tab/team_general_tab.tsx#L10
const InfoTab = (props: Props) => {
    const [name, setName] = useState<Team['display_name']>(props.team?.display_name ?? '');
    const [description, setDescription] = useState<Team['description']>(props.team?.description ?? '');
    const [teamIconFile, setTeamIconFile] = useState<File | undefined>();
    const [loading, setLoading] = useState<boolean>(false);
    const [imageClientError, setImageClientError] = useState<BaseSettingItemProps['error'] | undefined>();
    const [nameClientError, setNameClientError] = useState<BaseSettingItemProps['error'] | undefined>();
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>('saving');
    const {formatMessage} = useIntl();

    const handleNameDescriptionSubmit = async (): Promise<boolean> => {
        if (name?.trim() === props.team?.display_name && description === props.team?.description) {
            return true;
        }

        // todo sinan: when the input is empty clicking make the save changes panel green
        if (!name) {
            setNameClientError({id: 'general_tab.required', defaultMessage: 'This field is required'});
            return false;
        } else if (name.length < Constants.MIN_TEAMNAME_LENGTH) {
            setNameClientError({
                id: 'general_tab.teamNameRestrictions',
                defaultMessage: 'Team Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description.',
                values: {min: Constants.MIN_TEAMNAME_LENGTH, max: Constants.MAX_TEAMNAME_LENGTH},
            });
            return false;
        }
        setNameClientError(undefined);
        const {error} = await props.actions.patchTeam({id: props.team?.id, display_name: name, description});
        if (error) {
            return false;
        }
        return true;
    };

    const handleTeamIconSubmit = async (): Promise<boolean> => {
        if (!teamIconFile) {
            return true;
        }
        setLoading(true);
        setImageClientError(undefined);
        const {error} = await props.actions.setTeamIcon(props.team?.id || '', teamIconFile);
        setLoading(false);
        if (error) {
            return false;
        }
        return true;
    };

    const handleSaveChanges = async () => {
        const nameDescriptionSuccess = await handleNameDescriptionSubmit();
        const teamIconSuccess = await handleTeamIconSubmit();
        if (!teamIconSuccess || !nameDescriptionSuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        props.setHasChangeTabError(false);
    };

    const handleCancel = () => {
        setName(props.team?.display_name ?? props.team?.name ?? '');
        setDescription(props.team?.description ?? '');
        setTeamIconFile(undefined);
        setImageClientError(undefined);
        setNameClientError(undefined);
        handleClose();
    };

    const handleClose = () => {
        setSaveChangesPanelState('saving');
        props.setHasChanges(false);
        props.setHasChangeTabError(false);
    };

    const handleTeamIconRemove = async () => {
        setLoading(true);
        setImageClientError(undefined);
        setTeamIconFile(undefined);
        handleClose();

        const {error} = await props.actions.removeTeamIcon(props.team?.id || '');
        setLoading(false);
        if (error) {
            setSaveChangesPanelState('error');
            props.setHasChanges(true);
            props.setHasChangeTabError(true);
        }
    };

    const updateTeamIcon = (e: ChangeEvent<HTMLInputElement>) => {
        if (e && e.target && e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (!ACCEPTED_TEAM_IMAGE_TYPES.includes(file.type)) {
                setImageClientError({
                    id: 'general_tab.teamIconInvalidFileType',
                    defaultMessage: 'Only BMP, JPG or PNG images may be used for team icons',
                });
            } else if (file.size > props.maxFileSize) {
                setImageClientError({
                    id: 'general_tab.teamIconTooLarge',
                    defaultMessage: 'Unable to upload team icon. File is too large.',
                });
            } else {
                setTeamIconFile(file);
                setImageClientError(undefined);
                setSaveChangesPanelState('saving');
                props.setHasChanges(true);
            }
        } else {
            setTeamIconFile(undefined);
            setImageClientError({
                id: 'general_tab.teamIconError',
                defaultMessage: 'An error occurred while selecting the image.',
            });
        }
    };

    const handleNameChanges = (name: string) => {
        props.setHasChanges(true);
        setSaveChangesPanelState('saving');
        setName(name);
    };

    const handleDescriptionChanges = (description: string) => {
        props.setHasChanges(true);
        setSaveChangesPanelState('saving');
        setDescription(description);
    };

    const collapseModal = () => {
        if (props.hasChanges) {
            props.setHasChangeTabError(true);
            return;
        }
        props.collapseModal();
    };

    const modalSectionContent = (
        <>
            <div className='modal-header'>
                <button
                    id='closeButton'
                    type='button'
                    className='close'
                    data-dismiss='modal'
                    onClick={props.closeModal}
                >
                    <span aria-hidden='true'>{'×'}</span>
                </button>
                <h4 className='modal-title'>
                    <div className='modal-back'>
                        <i
                            className='fa fa-angle-left'
                            aria-label={formatMessage({
                                id: 'generic_icons.collapse',
                                defaultMessage: 'Collapes Icon',
                            })}
                            onClick={collapseModal}
                        />
                    </div>
                    <span>{formatMessage({id: 'team_settings_modal.title', defaultMessage: 'Team Settings'})}</span>
                </h4>
            </div>
            <div className='modal-info-tab-content user-settings' >
                <div className='name-description-container' >
                    <TeamNameSection
                        name={name}
                        clientError={nameClientError}
                        handleNameChanges={handleNameChanges}
                    />
                    <TeamDescriptionSection
                        description={description}
                        handleDescriptionChanges={handleDescriptionChanges}
                    />
                </div>
                <TeamPictureSection
                    team={props.team}
                    file={teamIconFile}
                    disabled={loading}
                    onFileChange={updateTeamIcon}
                    onRemove={handleTeamIconRemove}
                    teamName={props.team?.display_name ?? props.team?.name}
                    clientError={imageClientError}
                />
                {props.hasChanges ?
                    <SaveChangesPanel
                        handleCancel={handleCancel}
                        handleSubmit={handleSaveChanges}
                        handleClose={handleClose}
                        tabChangeError={props.hasChangeTabError}
                        state={saveChangesPanelState}
                    /> : undefined}
            </div>
        </>
    );

    return <ModalSection content={modalSectionContent}/>;
};
export default InfoTab;
