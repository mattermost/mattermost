// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import Constants from 'utils/constants';
import {imageURLForTeam} from 'utils/utils';

import TeamDescriptionSection from './team_description_section';
import TeamNameSection from './team_name_section';
import TeamPictureSection from './team_picture_section/team_picture_section';

import type {PropsFromRedux, OwnProps} from '.';

import './team_info_tab.scss';

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
// todo sinan: how to manage server errors
// todo sinan: fix tab changes when there is haveChanges
// todo sinan: fix saveChanges color
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

        // todo sinan handle case when there is no display name
        if (name === this.props.team?.display_name) {
            return;
        }

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

        // todo sinan: this is called even only name changes
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
        if (!this.state.teamIconFile || !this.state.submitActive || !this.state.haveImageChanges) {
            return;
        }

        this.setState({
            loadingIcon: true,
            imageClientError: undefined,
            serverError: '',
        });

        const {error} = await this.props.actions.setTeamIcon(this.props.team?.id || '', this.state.teamIconFile);

        if (error) {getDerivedStateFromProps
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
        await this.handleNameSubmit();
        await this.handleDescriptionSubmit();
        await this.handleTeamIconSubmit();
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
                    <TeamNameSection
                        setHaveChanges={(haveChanges) => this.setState({haveChanges})}
                        name={this.state.name}
                        clientError={this.state.nameClientError}
                        handleNameChanges={(name) => this.setState({name})}
                    />
                    <TeamDescriptionSection
                        setHaveChanges={(haveChanges) => this.setState({haveChanges})}
                        description={this.state.description}
                        clientError={this.state.descriptionClientError}
                        handleDescriptionChanges={(description) => this.setState({description})}
                    />
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
