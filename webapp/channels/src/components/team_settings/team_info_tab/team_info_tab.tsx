// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import type {ChangeEvent} from 'react';
import {defineMessages} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import Constants from 'utils/constants';

import TeamDescriptionSection from './team_description_section';
import TeamNameSection from './team_name_section';
import TeamPictureSection from './team_picture_section';

import type {PropsFromRedux, OwnProps} from '.';

import './team_info_tab.scss';

const ACCEPTED_TEAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];
const translations = defineMessages({
    Required: {
        id: 'general_tab.required',
        defaultMessage: 'This field is required',
    },
    TeamNameRestrictions: {
        id: 'general_tab.teamNameRestrictions',
        defaultMessage: 'Team Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description.',
        values: {min: Constants.MIN_TEAMNAME_LENGTH, max: Constants.MAX_TEAMNAME_LENGTH},
    },
    TeamIconInvalidFileType: {
        id: 'general_tab.teamIconInvalidFileType',
        defaultMessage: 'Only BMP, JPG or PNG images may be used for team icons',
    },
    TeamIconTooLarge: {
        id: 'general_tab.teamIconTooLarge',
        defaultMessage: 'Unable to upload team icon. File is too large.',
    },
    TeamIconError: {
        id: 'general_tab.teamIconError',
        defaultMessage: 'An error occurred while selecting the image.',
    },
});

type Props = PropsFromRedux & OwnProps;

const InfoTab = ({team, areThereUnsavedChanges, maxFileSize, showTabSwitchError, setShowTabSwitchError, setAreThereUnsavedChanges, actions}: Props) => {
    const [name, setName] = useState<Team['display_name']>(team.display_name);
    const [description, setDescription] = useState<Team['description']>(team.description);
    const [teamIconFile, setTeamIconFile] = useState<File | undefined>();
    const [loading, setLoading] = useState<boolean>(false);
    const [imageClientError, setImageClientError] = useState<BaseSettingItemProps['error'] | undefined>();
    const [nameClientError, setNameClientError] = useState<BaseSettingItemProps['error'] | undefined>();
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    const handleNameDescriptionSubmit = useCallback(async (): Promise<boolean> => {
        if (name.trim() === team.display_name && description === team.description) {
            return true;
        }

        if (!name) {
            setNameClientError(translations.Required);
            return false;
        } else if (name.length < Constants.MIN_TEAMNAME_LENGTH) {
            setNameClientError(translations.TeamNameRestrictions);
            return false;
        }
        setNameClientError(undefined);
        const {error} = await actions.patchTeam({id: team.id, display_name: name, description});
        if (error) {
            return false;
        }
        return true;
    }, [actions, description, name, team.description, team.display_name, team.id]);

    const handleTeamIconSubmit = useCallback(async (): Promise<boolean> => {
        if (!teamIconFile) {
            return true;
        }
        setLoading(true);
        setImageClientError(undefined);
        const {error} = await actions.setTeamIcon(team.id, teamIconFile);
        setLoading(false);
        if (error) {
            return false;
        }
        return true;
    }, [actions, team, teamIconFile]);

    const handleSaveChanges = useCallback(async () => {
        const nameDescriptionSuccess = await handleNameDescriptionSubmit();
        const teamIconSuccess = await handleTeamIconSubmit();
        if (!teamIconSuccess || !nameDescriptionSuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        setShowTabSwitchError(false);

        setAreThereUnsavedChanges(false);
    }, [handleNameDescriptionSubmit, handleTeamIconSubmit, setShowTabSwitchError, setAreThereUnsavedChanges]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState('editing');
        setAreThereUnsavedChanges(false);
        setShowTabSwitchError(false);
    }, [setShowTabSwitchError, setAreThereUnsavedChanges]);

    const handleCancel = useCallback(() => {
        setName(team.display_name ?? team.name);
        setDescription(team.description);
        setTeamIconFile(undefined);
        setImageClientError(undefined);
        setNameClientError(undefined);
        handleClose();
    }, [handleClose, team.description, team.display_name, team.name]);

    const handleTeamIconRemove = useCallback(async () => {
        setLoading(true);
        setImageClientError(undefined);
        setTeamIconFile(undefined);
        handleClose();

        const {error} = await actions.removeTeamIcon(team.id);
        setLoading(false);
        if (error) {
            setSaveChangesPanelState('error');
            setAreThereUnsavedChanges(true);
            setShowTabSwitchError(true);
        }
    }, [actions, handleClose, setShowTabSwitchError, setAreThereUnsavedChanges, team.id]);

    const updateTeamIcon = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (e && e.target && e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (!ACCEPTED_TEAM_IMAGE_TYPES.includes(file.type)) {
                setImageClientError(translations.TeamIconInvalidFileType);
            } else if (file.size > maxFileSize) {
                setImageClientError(translations.TeamIconTooLarge);
            } else {
                setTeamIconFile(file);
                setImageClientError(undefined);
                setSaveChangesPanelState('editing');
                setAreThereUnsavedChanges(true);
            }
        } else {
            setTeamIconFile(undefined);
            setImageClientError(translations.TeamIconError);
        }
    }, [maxFileSize, setAreThereUnsavedChanges]);

    const handleNameChanges = useCallback((name: string) => {
        setAreThereUnsavedChanges(true);
        setSaveChangesPanelState('editing');
        setName(name);
    }, [setAreThereUnsavedChanges]);

    const handleDescriptionChanges = useCallback((description: string) => {
        setAreThereUnsavedChanges(true);
        setSaveChangesPanelState('editing');
        setDescription(description);
    }, [setAreThereUnsavedChanges]);

    return (
        <div
            className='modal-info-tab-content user-settings'
            id='infoSettings'
            aria-labelledby='infoButton'
            role='tabpanel'
        >
            <div className='name-description-container'>
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
                team={team}
                file={teamIconFile}
                disabled={loading}
                onFileChange={updateTeamIcon}
                onRemove={handleTeamIconRemove}
                teamName={team.display_name ?? team.name}
                clientError={imageClientError}
            />
            {(areThereUnsavedChanges || saveChangesPanelState === 'saved') && (
                <SaveChangesPanel
                    handleCancel={handleCancel}
                    handleSubmit={handleSaveChanges}
                    handleClose={handleClose}
                    tabChangeError={showTabSwitchError}
                    state={saveChangesPanelState}
                />
            )}
        </div>
    );
};

export default InfoTab;
