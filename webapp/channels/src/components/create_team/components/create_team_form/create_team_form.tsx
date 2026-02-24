// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import type {Button} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';

import ExternalLink from 'components/external_link';

import Constants from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import DisplayNameStep from './display_name_step';
import TeamUrlStep from './team_url_step';

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

export default function CreateTeamForm({step, state: parentState, updateParent, actions, history}: Props) {
    const teamURLInput = useRef<HTMLInputElement>(null);
    const config = useSelector(getConfig);

    const [teamDisplayName, setTeamDisplayName] = useState<string>(parentState.team?.display_name || '');
    const [teamURL, setTeamURL] = useState<string>(parentState.team?.name || '');
    const [nameError, setNameError] = useState<string | JSX.Element>('');
    const [isLoading, setIsLoading] = useState(false);

    const isValidTeamName = teamDisplayName.length >= Constants.MIN_TEAMNAME_LENGTH && teamDisplayName.length <= Constants.MAX_TEAMNAME_LENGTH;

    const doCreateTeam = useCallback(async () => {
        const {createTeam} = actions;

        setIsLoading(true);
        const teamSignup = JSON.parse(JSON.stringify(parentState));
        teamSignup.team.type = 'O';
        teamSignup.team.display_name = teamDisplayName.trim();
        teamSignup.team.name = teamURL.trim();

        const createTeamData = await createTeam(teamSignup.team);
        const data = createTeamData.data;
        const error = createTeamData.error;

        if (data) {
            history.push(
                '/' + data.name + '/channels/' + Constants.DEFAULT_CHANNEL,
            );
        } else if (error) {
            setNameError(error.message);
            setIsLoading(false);
        }
    }, [actions, history, parentState, teamDisplayName, teamURL]);

    const submitDisplayName = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        if (!isValidTeamName) {
            return;
        }

        if (config.PrivacySettings?.UseSecureURLs) {
            doCreateTeam();
            return;
        }

        const displayName = teamDisplayName.trim();
        const newState = parentState;
        newState.wizard = 'team_url';
        newState.team!.display_name = displayName;
        newState.team!.name = cleanUpUrlable(displayName);
        setTeamURL(newState.team!.name.trim());

        updateParent(newState);
    }, [isValidTeamName, teamDisplayName, parentState, config.PrivacySettings?.UseSecureURLs, updateParent, doCreateTeam]);

    const handleDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamDisplayName(e.target.value);
    }, []);

    const submitBack = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        e.preventDefault();
        const newState = parentState;
        newState.wizard = 'display_name';
        updateParent(newState);
    }, [parentState, updateParent]);

    const teamNameValidations = useCallback(
        async (name: string): Promise<boolean> => {
            const {checkIfTeamExists} = actions;

            const cleanedName = cleanUpUrlable(name);
            const urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;

            if (!name) {
                setNameError(
                    <FormattedMessage
                        id='create_team.team_url.required'
                        defaultMessage='This field is required'
                    />,
                );
                teamURLInput.current?.focus();
                return false;
            }

            if (
                cleanedName.length < Constants.MIN_TEAMNAME_LENGTH ||
                cleanedName.length > Constants.MAX_TEAMNAME_LENGTH
            ) {
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
                return false;
            }

            if (cleanedName !== name || !urlRegex.test(name)) {
                setNameError(
                    <FormattedMessage
                        id='create_team.team_url.regex'
                        defaultMessage="Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash."
                    />,
                );
                teamURLInput.current?.focus();
                return false;
            }

            for (
                let index = 0;
                index < Constants.RESERVED_TEAM_NAMES.length;
                index++
            ) {
                if (
                    cleanedName.indexOf(
                        Constants.RESERVED_TEAM_NAMES[index],
                    ) === 0
                ) {
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
                    return false;
                }
            }

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
                return false;
            }

            return true;
        },
        [actions],
    );

    const submitTeamUrl = useCallback(async (e: React.MouseEvent<Button, MouseEvent>) => {
        e.preventDefault();

        const teamNameValid = await teamNameValidations(teamURL);
        if (!teamNameValid) {
            return;
        }

        await doCreateTeam();
    }, [teamURL, teamNameValidations, doCreateTeam]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.currentTarget.select();
    }, []);

    const handleTeamURLInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamURL(e.target.value.trim());
    }, []);

    if (step === 'team_url') {
        return (
            <TeamUrlStep
                teamURL={teamURL}
                nameError={nameError}
                isLoading={isLoading}
                teamURLInput={teamURLInput}
                onTeamURLChange={handleTeamURLInputChange}
                onFocus={handleFocus}
                onSubmit={submitTeamUrl}
                onBack={submitBack}
            />
        );
    }

    return (
        <DisplayNameStep
            teamDisplayName={teamDisplayName}
            isValidTeamName={isValidTeamName}
            onDisplayNameChange={handleDisplayNameChange}
            onSubmit={submitDisplayName}
        />
    );
}
