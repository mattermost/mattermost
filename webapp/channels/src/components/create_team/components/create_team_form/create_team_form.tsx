// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import {Button} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ExternalLink from 'components/external_link';
import Input from 'components/widgets/inputs/input/input';
import WithTooltip from 'components/with_tooltip';

import logoImage from 'images/logo.png';
import Constants from 'utils/constants';
import * as URL from 'utils/url';
import {cleanUpUrlable} from 'utils/url';

type CreateTeamState = {
    team?: Partial<Team>;
    wizard: string;
};

type Props = {
    step: 'display_name' | 'team_url';
    state: CreateTeamState;
    updateParent: (state: CreateTeamState) => void;
    actions: {
        checkIfTeamExists: (teamName: string) => Promise<ActionResult<boolean>>;
        createTeam: (team: Team) => Promise<ActionResult<Team>>;
    };
    history: {
        push(path: string): void;
    };
};

export default function CreateTeamForm(props: Props) {
    const {step, state: parentState, updateParent, actions, history} = props;

    const teamURLInput = useRef<HTMLInputElement>(null);

    const [teamDisplayName, setTeamDisplayName] = useState(parentState.team?.display_name || '');
    const [teamURL, setTeamURL] = useState(parentState.team?.name);
    const [nameError, setNameError] = useState<string | JSX.Element>('');
    const [isLoading, setIsLoading] = useState(false);

    // Display Name step

    const isValidTeamName = teamDisplayName.length >= Constants.MIN_TEAMNAME_LENGTH && teamDisplayName.length <= Constants.MAX_TEAMNAME_LENGTH;

    const submitDisplayName = useCallback((e: React.MouseEvent) => {
        if (!isValidTeamName) {
            return;
        }

        e.preventDefault();
        const displayName = teamDisplayName.trim();

        const newState = parentState;
        newState.wizard = 'team_url';
        newState.team!.display_name = displayName;
        newState.team!.name = cleanUpUrlable(displayName);
        setTeamURL(newState.team!.name);
        updateParent(newState);
    }, [isValidTeamName, teamDisplayName, parentState, updateParent]);

    const handleDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamDisplayName(e.target.value);
    }, []);

    // Team URL step

    const submitBack = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        e.preventDefault();
        const newState = parentState;
        newState.wizard = 'display_name';
        updateParent(newState);
    }, [parentState, updateParent]);

    const submitTeamUrl = useCallback(async (e: React.MouseEvent<Button, MouseEvent>) => {
        e.preventDefault();

        const name = teamURL!.trim();
        const cleanedName = URL.cleanUpUrlable(name);
        const urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;
        const {checkIfTeamExists, createTeam} = actions;

        if (!name) {
            setNameError(
                <FormattedMessage
                    id='create_team.team_url.required'
                    defaultMessage='This field is required'
                />,
            );
            teamURLInput.current?.focus();
            return;
        }

        if (cleanedName.length < Constants.MIN_TEAMNAME_LENGTH || cleanedName.length > Constants.MAX_TEAMNAME_LENGTH) {
            setNameError(
                <FormattedMessage
                    id='create_team.team_url.charLength'
                    defaultMessage='Name must be {min} or more characters up to a maximum of {max}'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />,
            );
            teamURLInput.current?.focus();
            return;
        }

        if (cleanedName !== name || !urlRegex.test(name)) {
            setNameError(
                <FormattedMessage
                    id='create_team.team_url.regex'
                    defaultMessage="Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash."
                />,
            );
            teamURLInput.current?.focus();
            return;
        }

        for (let index = 0; index < Constants.RESERVED_TEAM_NAMES.length; index++) {
            if (cleanedName.indexOf(Constants.RESERVED_TEAM_NAMES[index]) === 0) {
                setNameError(
                    <FormattedMessage
                        id='create_team.team_url.taken'
                        defaultMessage='This URL <link>starts with a reserved word</link> or is unavailable. Please try another.'
                        values={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://docs.mattermost.com/help/getting-started/creating-teams.html#team-url'
                                    location='team_url'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />,
                );
                return;
            }
        }

        setIsLoading(true);
        const teamSignup = JSON.parse(JSON.stringify(parentState));
        teamSignup.team.type = 'O';
        teamSignup.team.name = name;

        const checkIfTeamExistsData = await checkIfTeamExists(name);
        const exists = checkIfTeamExistsData.data;

        if (exists) {
            setNameError(
                <FormattedMessage
                    id='create_team.team_url.unavailable'
                    defaultMessage='This URL is taken or unavailable. Please try another.'
                />,
            );
            setIsLoading(false);
            return;
        }

        const createTeamData = await createTeam(teamSignup.team);
        const data = createTeamData.data;
        const error = createTeamData.error;

        if (data) {
            history.push('/' + data.name + '/channels/' + Constants.DEFAULT_CHANNEL);
        } else if (error) {
            setNameError(error.message);
            setIsLoading(false);
        }
    }, [teamURL, actions, parentState, history]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.currentTarget.select();
    }, []);

    const handleTeamURLInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamURL(e.target.value);
    }, []);

    if (step === 'team_url') {
        let nameErrorLabel = null;
        let nameDivClass = 'form-group';
        if (nameError) {
            nameErrorLabel = (
                <label
                    role='alert'
                    className='control-label'
                    id='teamURLInputError'
                >
                    {nameError}
                </label>
            );
            nameDivClass += ' has-error';
        }

        const title = `${URL.getSiteURL()}/`;

        let finishMessage = (
            <FormattedMessage
                id='create_team.team_url.finish'
                defaultMessage='Finish'
            />
        );

        if (isLoading) {
            finishMessage = (
                <FormattedMessage
                    id='create_team.team_url.creatingTeam'
                    defaultMessage='Creating team...'
                />
            );
        }

        return (
            <div>
                <form>
                    <img
                        alt={'signup team logo'}
                        className='signup-team-logo'
                        src={logoImage}
                    />
                    <label htmlFor='teamURLInput'>
                        <FormattedMessage
                            id='create_team.team_url.teamUrl'
                            tagName='strong'
                            defaultMessage='Team URL'
                        />
                    </label>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-11'>
                                <div className='input-group input-group--limit'>
                                    <WithTooltip
                                        title={title}
                                    >
                                        <span className='input-group-addon'>
                                            {title}
                                        </span>
                                    </WithTooltip>
                                    <input
                                        id='teamURLInput'
                                        type='text'
                                        ref={teamURLInput}
                                        className='form-control'
                                        placeholder=''
                                        maxLength={128}
                                        value={teamURL}
                                        autoFocus={true}
                                        onFocus={handleFocus}
                                        onChange={handleTeamURLInputChange}
                                        spellCheck='false'
                                        aria-describedby='teamURLInputError'
                                    />
                                </div>
                            </div>
                        </div>
                        {nameErrorLabel}
                    </div>
                    <p>
                        <FormattedMessage
                            id='create_team.team_url.webAddress'
                            defaultMessage='Choose the web address of your new team:'
                        />
                    </p>
                    <ul className='color--light'>
                        <li>
                            <FormattedMessage
                                id='create_team.team_url.hint1'
                                defaultMessage='Short and memorable is best'
                            />
                        </li>
                        <li>
                            <FormattedMessage
                                id='create_team.team_url.hint2'
                                defaultMessage='Use lowercase letters, numbers and dashes'
                            />
                        </li>
                        <li>
                            <FormattedMessage
                                id='create_team.team_url.hint3'
                                defaultMessage="Must start with a letter and can't end in a dash"
                            />
                        </li>
                    </ul>
                    <div className='mt-8'>
                        <Button
                            id='teamURLFinishButton'
                            type='submit'
                            bsStyle='primary'
                            disabled={isLoading}
                            onClick={(e: React.MouseEvent<Button, MouseEvent>) => submitTeamUrl(e)}
                        >
                            {finishMessage}
                        </Button>
                    </div>
                    <div className='mt-8'>
                        <a
                            href='#'
                            onClick={submitBack}
                        >
                            <FormattedMessage
                                id='create_team.team_url.back'
                                defaultMessage='Back to previous step'
                            />
                        </a>
                    </div>
                </form>
            </div>
        );
    }

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
                                value={teamDisplayName}
                                autoFocus={true}
                                onChange={handleDisplayNameChange}
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
                    onClick={submitDisplayName}
                    disabled={!isValidTeamName}
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
