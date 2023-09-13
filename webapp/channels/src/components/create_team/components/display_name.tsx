// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import NextIcon from 'components/widgets/icons/fa_next_icon';

import logoImage from 'images/logo.png';
import Constants from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

type CreateTeamState = {
    team?: Partial<Team>;
    wizard: string;
};

type Props = {

    /*
     * Object containing team's display_name and name
     */
    state: CreateTeamState;

    /*
     * Function that updates parent component with state props
     */
    updateParent: (state: CreateTeamState) => void;
}

type State = {
    teamDisplayName: string;
    nameError?: React.ReactNode;
}

export default class TeamSignupDisplayNamePage extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            teamDisplayName: this.props.state.team?.display_name || '',
        };
    }

    componentDidMount(): void {
        trackEvent('signup', 'signup_team_01_name');
    }

    submitNext = (e: React.MouseEvent): void => {
        e.preventDefault();
        trackEvent('display_name', 'click_next');
        const displayName = this.state.teamDisplayName.trim();
        if (!displayName) {
            this.setState({nameError: (
                <FormattedMessage
                    id='create_team.display_name.required'
                    defaultMessage='This field is required'
                />),
            });
            return;
        } else if (displayName.length < Constants.MIN_TEAMNAME_LENGTH || displayName.length > Constants.MAX_TEAMNAME_LENGTH) {
            this.setState({nameError: (
                <FormattedMessage
                    id='create_team.display_name.charLength'
                    defaultMessage='Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description later.'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />),
            });
            return;
        }

        const newState = this.props.state;
        newState.wizard = 'team_url';
        newState.team!.display_name = displayName;
        newState.team!.name = cleanUpUrlable(displayName);
        this.props.updateParent(newState);
    };

    handleFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
        e.preventDefault();
        e.currentTarget.select();
    };

    handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({teamDisplayName: e.target.value});
    };

    render(): React.ReactNode {
        let nameError = null;
        let nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        return (
            <div>
                <form>
                    <img
                        alt={'signup logo'}
                        className='signup-team-logo'
                        src={logoImage}
                    />
                    <h5>
                        <FormattedMessage
                            id='create_team.display_name.teamName'
                            tagName='strong'
                            defaultMessage='Team Name'
                        />
                    </h5>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <input
                                    id='teamNameInput'
                                    type='text'
                                    className='form-control'
                                    placeholder=''
                                    maxLength={128}
                                    value={this.state.teamDisplayName}
                                    autoFocus={true}
                                    onFocus={this.handleFocus}
                                    onChange={this.handleDisplayNameChange}
                                    spellCheck='false'
                                />
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <div>
                        <FormattedMessage
                            id='create_team.display_name.nameHelp'
                            defaultMessage='Name your team in any language. Your team name shows in menus and headings.'
                        />
                    </div>
                    <button
                        id='teamNameNextButton'
                        type='submit'
                        className='btn btn-primary mt-8'
                        onClick={this.submitNext}
                    >
                        <FormattedMessage
                            id='create_team.display_name.next'
                            defaultMessage='Next'
                        />
                        <NextIcon/>
                    </button>
                </form>
            </div>
        );
    }
}
