// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import Input from 'components/widgets/inputs/input/input';
import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import Constants from 'utils/constants';
import {imageURLForTeam} from 'utils/utils';

import TeamPictureSection from '../team_picture_section/team_picture_section';

import type {PropsFromRedux, OwnProps} from '.';

import './team_info_section.scss';

const ACCEPTED_TEAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];

type Props = PropsFromRedux & OwnProps & WrappedComponentProps;

type State = {
    name?: Team['display_name'];
    description?: Team['description'];
    serverError: ReactNode;
    imageClientError?: BaseSettingItemProps['error'];
    nameClientError?: BaseSettingItemProps['error'];
    descriptionClientError?: BaseSettingItemProps['error'];
    teamIconFile: File | null;
    loadingIcon: boolean;
    submitActive: boolean;
    isInitialState: boolean;
    shouldFetchTeam?: boolean;
    haveChanges: boolean;
    haveImageChanges: boolean;
}

// todo sinan: LearnAboutTeamsLink check https://github.com/mattermost/mattermost/blob/af7bc8a4a90d8c4c17a82dc86bc898d378dec2ff/webapp/channels/src/components/team_general_tab/team_general_tab.tsx#L10
// todo sinan: think about to put name, description and image section into different files
export class InfoTab extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = this.setupInitialState(props);
    }

    setupInitialState(props: Props) {
        const team = props.team;

        return {
            name: team?.display_name,
            description: team?.description,
            serverError: '',
            teamIconFile: null,
            loadingIcon: false,
            submitActive: false,
            haveChanges: false,
            haveImageChanges: false,
            isInitialState: true,
        };
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        const {team} = nextProps;
        if (!prevState.isInitialState) {
            return {
                name: team?.display_name,
                description: team?.description,
                isInitialState: false,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!prevState.shouldFetchTeam && this.state.shouldFetchTeam) {
            this.fetchTeam();
        }
    }

    fetchTeam() {
        if (this.state.serverError) {
            return;
        }
        if (this.props.team) {
            this.props.actions.getTeam(this.props.team.id).then(({error}) => {
                const state = {
                    shouldFetchTeam: false,
                    serverError: '',
                };
                if (error) {
                    state.serverError = error.message;
                }
                this.setState(state);
            });
        }
    }

    handleNameSubmit = async () => {
        const state: Pick<State, 'serverError' | 'nameClientError'> = {serverError: '', nameClientError: undefined};
        let valid = true;

        const name = this.state.name?.trim();

        if (!name) {
            state.nameClientError = {id: 'general_tab.required', defaultMessage: 'This field is required'};
            valid = false;
        } else if (name.length < Constants.MIN_TEAMNAME_LENGTH) {
            state.nameClientError = {
                id: 'general_tab.teamNameRestrictions',
                defaultMessage: 'Team Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description.',
                values: {min: Constants.MIN_TEAMNAME_LENGTH, max: Constants.MAX_TEAMNAME_LENGTH},
            };

            valid = false;
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        const data = {
            id: this.props.team?.id,
            display_name: this.state.name,
        };
        const {error} = await this.props.actions.patchTeam(data);

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        }
    };

    handleDescriptionSubmit = async () => {
        const state: Pick<State, 'serverError' | 'descriptionClientError'> = {serverError: '', descriptionClientError: undefined};
        let valid = true;

        const description = this.state.description?.trim();
        if (description === this.props.team?.description) {
            state.descriptionClientError = {id: 'general_tab.chooseDescription', defaultMessage: 'Please choose a new description for your team'};
            valid = false;
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        const data = {
            id: this.props.team?.id,
            description: this.state.description,
        };
        const {error} = await this.props.actions.patchTeam(data);

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        }
    };

    handleTeamIconSubmit = async () => {
        if (!this.state.teamIconFile || !this.state.submitActive) {
            return;
        }

        this.setState({
            loadingIcon: true,
            imageClientError: undefined,
            serverError: '',
        });

        const {error} = await this.props.actions.setTeamIcon(this.props.team?.id || '', this.state.teamIconFile);

        if (error) {
            this.setState({
                loadingIcon: false,
                serverError: error.message,
            });
        } else {
            this.setState({
                loadingIcon: false,
                submitActive: false,
            });
        }
    };

    handleSaveChanges = async () => {
        // todo sinan handle case when there is no display name
        if (this.state.name !== this.props.team?.display_name) {
            await this.handleNameSubmit();
        }

        await this.handleDescriptionSubmit();

        if (this.state.haveImageChanges) {
            await this.handleTeamIconSubmit();
        }
        this.setState({
            haveChanges: false,
            haveImageChanges: false,
        });
    };

    handleCancel = () => {
        this.setState({
            name: this.props.team?.display_name || this.props.team?.name,
            description: this.props.team?.description,
            teamIconFile: null,
            haveChanges: false,
            imageClientError: undefined,
            haveImageChanges: false,
        });
    };

    handleTeamIconRemove = async () => {
        this.setState({
            loadingIcon: true,
            imageClientError: undefined,
            serverError: '',
            teamIconFile: null,
            haveImageChanges: false,
        });

        const {error} = await this.props.actions.removeTeamIcon(this.props.team?.id || '');

        if (error) {
            this.setState({
                loadingIcon: false,
                serverError: error.message,
            });
        } else {
            this.setState({
                loadingIcon: false,
                submitActive: false,
            });
        }
    };

    updateName = (e: ChangeEvent<HTMLInputElement>) => this.setState({name: e.target.value, haveChanges: true});

    updateDescription = (e: ChangeEvent<HTMLInputElement>) => this.setState({description: e.target.value, haveChanges: true});

    updateTeamIcon = (e: ChangeEvent<HTMLInputElement>) => {
        if (e && e.target && e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (!ACCEPTED_TEAM_IMAGE_TYPES.includes(file.type)) {
                this.setState({
                    imageClientError: {id: 'general_tab.teamIconInvalidFileType', defaultMessage: 'Only BMP, JPG or PNG images may be used for team icons'},
                });
            } else if (file.size > this.props.maxFileSize) {
                this.setState({
                    imageClientError: {id: 'general_tab.teamIconTooLarge', defaultMessage: 'Unable to upload team icon. File is too large.'},
                });
            } else {
                this.setState({
                    teamIconFile: e.target.files[0],
                    imageClientError: undefined,
                    submitActive: true,
                    haveImageChanges: true,
                });
            }
        } else {
            this.setState({
                teamIconFile: null,
                imageClientError: {id: 'general_tab.teamIconError', defaultMessage: 'An error occurred while selecting the image.'},
            });
        }
    };

    render() {
        const team = this.props.team;
        const serverError = this.state.serverError ?? null;

        const nameSectionInput = (
            <Input
                id='teamName'
                className='form-control'
                type='text'
                maxLength={Constants.MAX_TEAMNAME_LENGTH}
                onChange={this.updateName}
                value={this.state.name}
                label={this.props.intl.formatMessage({id: 'general_tab.teamName', defaultMessage: 'Team Name'})}
            />
        );

        // todo sinan what to do with submit and errors
        // const nameSection = (
        //     <SettingItemMax
        //         submit={this.handleNameSubmit}
        //         serverError={serverError}
        //         clientError={clientError}
        //     />
        // );

        const nameSection = (
            <BaseSettingItem
                title={{id: 'general_tab.teamInfo', defaultMessage: 'Team info'}}
                description={{id: 'general_tab.teamNameInfo', defaultMessage: 'This name will appear on your sign-in screen and at the top of the left sidebar.'}}
                content={nameSectionInput}
                error={this.state.nameClientError}
            />
        );

        const descriptionSectionInput = (
            <Input
                id='teamDescription'
                className='form-control'
                containerClassName='description-section-input'
                type='textarea'
                maxLength={Constants.MAX_TEAMDESCRIPTION_LENGTH}
                onChange={this.updateDescription}
                value={this.state.description}
                label={this.props.intl.formatMessage({id: 'general_tab.teamDescription', defaultMessage: 'Description'})}
            />
        );

        // todo sinan: what to do with remaining props
        // const descriptionSection = (
        //     <SettingItemMax
        //         submit={this.handleDescriptionSubmit}
        //         serverError={serverError}
        //         clientError={clientError}
        //     />
        // );

        const descriptionSection = (
            <BaseSettingItem
                description={{id: 'general_tab.teamDescriptionInfo', defaultMessage: 'Team description provides additional information to help users select the right team. Maximum of 50 characters.'}}
                content={descriptionSectionInput}
                className='description-setting-item'
                error={this.state.descriptionClientError}
            />
        );

        const teamImageSource = imageURLForTeam(team || {} as Team);

        const teamPictureSection = (
            <TeamPictureSection
                src={teamImageSource}
                file={this.state.teamIconFile}
                loadingPicture={this.state.loadingIcon}
                onFileChange={this.updateTeamIcon}
                onRemove={this.handleTeamIconRemove}
                teamName={this.props.team?.display_name ?? this.props.team?.name}
            />
        );

        // todo sinan: fix spacing above 50MB
        const teamIconSection = (
            <BaseSettingItem
                title={{id: 'setting_picture.title', description: 'Team icon'}}
                description={teamImageSource ? undefined : {id: 'setting_picture.help.team', defaultMessage: 'Upload a picture in BMP, JPG, JPEG, or PNG format. \nMaximum file size: 50MB'}}
                content={teamPictureSection}
                className='picture-setting-item'
                error={this.state.imageClientError}
            />
        );

        // todo sinan: check mobile view in Figma
        const modalSectionContent = (
            <div className='modal-info-tab-content' >
                <div className='name-description-container' >
                    {nameSection}
                    {descriptionSection}
                </div>
                {teamIconSection}
                {this.state.haveChanges || this.state.haveImageChanges ?
                    <SaveChangesPanel
                        handleCancel={this.handleCancel}
                        handleSubmit={this.handleSaveChanges}
                    /> : undefined}
            </div>
        );

        return (
            <ModalSection
                content={modalSectionContent}
            />
        );
    }
}
export default injectIntl(InfoTab);
