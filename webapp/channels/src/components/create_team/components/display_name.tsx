// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import Input from 'components/widgets/inputs/input/input';

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
}

export default class TeamSignupDisplayNamePage extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            teamDisplayName: this.props.state.team?.display_name || '',
        };
    }

    isValidTeamName = (): boolean => {
        return this.state.teamDisplayName.length >= Constants.MIN_TEAMNAME_LENGTH && this.state.teamDisplayName.length <= Constants.MAX_TEAMNAME_LENGTH;
    };

    submitNext = (e: React.MouseEvent): void => {
        if (!this.isValidTeamName()) {
            return;
        }

        e.preventDefault();
        const displayName = this.state.teamDisplayName.trim();

        const newState = this.props.state;
        newState.wizard = 'team_url';
        newState.team!.display_name = displayName;
        newState.team!.name = cleanUpUrlable(displayName);
        this.props.updateParent(newState);
    };

    handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({teamDisplayName: e.target.value});
    };

    render(): React.ReactNode {
        return (
            <div>
                <form>
                    <img
                        alt={'signup logo'}
                        className='signup-team-logo'
                        src={logoImage}
                    />
                    <label htmlFor='teamNameInput'>
                        <FormattedMessage
                            id='create_team.display_name.teamName'
                            tagName='strong'
                            defaultMessage='Team Name'
                        />
                    </label>
                    <div className='form-group'>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <Input
                                    id='teamNameInput'
                                    name='teamNameInput'
                                    type='text'
                                    value={this.state.teamDisplayName}
                                    autoFocus={true}
                                    onChange={this.handleDisplayNameChange}
                                    required={true}
                                    maxLength={Constants.MAX_TEAMNAME_LENGTH}
                                    minLength={Constants.MIN_TEAMNAME_LENGTH}
                                    spellCheck='false'
                                />
                            </div>
                        </div>
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
                        disabled={!this.isValidTeamName()}
                    >
                        <FormattedMessage
                            id='create_team.display_name.next'
                            defaultMessage='Next'
                        />
                        <i className='icon icon-chevron-right'/>
                    </button>
                </form>
            </div>
        );
    }
}
