// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {FormattedMessage, injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import SettingPicture from 'components/setting_picture';
import Input from 'components/widgets/inputs/input/input';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';

import Constants from 'utils/constants';
import {imageURLForTeam, localizeMessage, moveCursorToEnd} from 'utils/utils';

import type {PropsFromRedux, OwnProps} from '.';
import './team_info_tab.scss';

const ACCEPTED_TEAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];

type Props = PropsFromRedux & OwnProps & WrappedComponentProps;

type State = {
    name?: Team['display_name'];
    description?: Team['description'];
    serverError: ReactNode;
    clientError: ReactNode;
    teamIconFile: File | null;
    loadingIcon: boolean;
    submitActive: boolean;
    isInitialState: boolean;
    shouldFetchTeam?: boolean;
}

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
            clientError: '',
            teamIconFile: null,
            loadingIcon: false,
            submitActive: false,
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
        const state: Pick<State, 'serverError' | 'clientError'> = {serverError: '', clientError: ''};
        let valid = true;

        const name = this.state.name?.trim();

        if (!name) {
            state.clientError = localizeMessage('general_tab.required', 'This field is required');
            valid = false;
        } else if (name.length < Constants.MIN_TEAMNAME_LENGTH) {
            state.clientError = (
                <FormattedMessage
                    id='general_tab.teamNameRestrictions'
                    defaultMessage='Team Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description.'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />
            );

            valid = false;
        } else {
            state.clientError = '';
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
        const state = {serverError: '', clientError: ''};
        let valid = true;

        const description = this.state.description?.trim();
        if (description === this.props.team?.description) {
            state.clientError = localizeMessage('general_tab.chooseDescription', 'Please choose a new description for your team');
            valid = false;
        } else {
            state.clientError = '';
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
            clientError: '',
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

    handleTeamIconRemove = async () => {
        this.setState({
            loadingIcon: true,
            clientError: '',
            serverError: '',
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

    updateName = (e: ChangeEvent<HTMLInputElement>) => this.setState({name: e.target.value});

    updateDescription = (e: ChangeEvent<HTMLInputElement>) => this.setState({description: e.target.value});

    updateTeamIcon = (e: ChangeEvent<HTMLInputElement>) => {
        if (e && e.target && e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (!ACCEPTED_TEAM_IMAGE_TYPES.includes(file.type)) {
                this.setState({
                    clientError: localizeMessage('general_tab.teamIconInvalidFileType', 'Only BMP, JPG or PNG images may be used for team icons'),
                });
            } else if (file.size > this.props.maxFileSize) {
                this.setState({
                    clientError: localizeMessage('general_tab.teamIconTooLarge', 'Unable to upload team icon. File is too large.'),
                });
            } else {
                this.setState({
                    teamIconFile: e.target.files[0],
                    clientError: '',
                    submitActive: true,
                });
            }
        } else {
            this.setState({
                teamIconFile: null,
                clientError: localizeMessage('general_tab.teamIconError', 'An error occurred while selecting the image.'),
            });
        }
    };

    render() {
        const team = this.props.team;

        const clientError = this.state.clientError;
        const serverError = this.state.serverError ?? null;

        const nameSectionInput = (
            <Input
                id='teamName'
                autoFocus={true}
                className='form-control'
                type='text'
                maxLength={Constants.MAX_TEAMNAME_LENGTH}
                onChange={this.updateName}
                value={this.state.name}
                onFocus={moveCursorToEnd}
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
                description={{id: 'general_tab.teamNameInfo', defaultMessage: 'Set the name of the team as it appears on your sign-in screen and at the top of the left-hand sidebar.'}}
                content={nameSectionInput}
            />
        );

        // todo sinan: update Input component when passed textarea use text area
        const descriptionSectionInput = (
            <Input
                id='teamDescription'
                autoFocus={true}
                className='form-control'
                containerClassName='description-section-input'
                type='textarea'
                maxLength={Constants.MAX_TEAMDESCRIPTION_LENGTH}
                onChange={this.updateDescription}
                value={this.state.description}
                onFocus={moveCursorToEnd}
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
            />
        );

        const helpText = (
            <FormattedMessage
                id='setting_picture.help.team'
                defaultMessage='Upload a team icon in BMP, JPG or PNG format.\nSquare images with a solid background color are recommended.'
            />
        );
        const teamIconSection = (
            <SettingPicture
                imageContext='team'
                title={localizeMessage('general_tab.teamIcon', 'Team Icon')}
                src={imageURLForTeam(team || {} as Team)}
                file={this.state.teamIconFile}
                serverError={this.state.serverError}
                clientError={this.state.clientError}
                loadingPicture={this.state.loadingIcon}
                submitActive={this.state.submitActive}
                onFileChange={this.updateTeamIcon}
                onSubmit={this.handleTeamIconSubmit}
                onRemove={this.handleTeamIconRemove}
                helpText={helpText}
            />
        );

        const modalSectionContent = (
            <div className='modal-info-tab-content' >
                <div>
                    {nameSection}
                    {descriptionSection}
                </div>
                {teamIconSection}
            </div>
        );

        return (
            <ModalSection
                title={{id: 'general_tab.teamName', defaultMessage: 'Team Name'}}
                content={modalSectionContent}
            />
        );
    }
}
export default injectIntl(InfoTab);
