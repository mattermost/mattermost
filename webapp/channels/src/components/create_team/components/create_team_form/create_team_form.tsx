// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {isAnonymousURLEnabled} from 'selectors/config';

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
    const UseAnonymousURLs = useSelector(isAnonymousURLEnabled);

    const [teamDisplayName, setTeamDisplayName] = useState<string>(parentState.team?.display_name || '');
    const [teamURL, setTeamURL] = useState<string>(parentState.team?.name || '');
    const [nameError, setNameError] = useState<string | JSX.Element>('');

    const isLoadingGuard = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    const isValidTeamName = teamDisplayName.length >= Constants.MIN_TEAMNAME_LENGTH && teamDisplayName.length <= Constants.MAX_TEAMNAME_LENGTH;

    const startLoading = useCallback((): boolean => {
        if (isLoadingGuard.current) {
            return false;
        }

        isLoadingGuard.current = true;
        setIsLoading(true);
        return true;
    }, []);

    const stopLoading = useCallback(() => {
        isLoadingGuard.current = false;
        setIsLoading(false);
    }, []);

    const doCreateTeam = useCallback(async () => {
        const {createTeam} = actions;

        if (!startLoading()) {
            return;
        }

        const teamDraft = {
            ...(parentState.team ?? {}),
            type: 'O',
            display_name: teamDisplayName.trim(),
            name: teamURL.trim(),
        } as Team;

        const createTeamData = await createTeam(teamDraft);
        const data = createTeamData.data;
        const error = createTeamData.error;

        if (data) {
            history.push('/' + data.name + '/channels/' + Constants.DEFAULT_CHANNEL);
        } else if (error) {
            setNameError(error.message);
        }

        stopLoading();
    }, [actions, history, parentState.team, startLoading, stopLoading, teamDisplayName, teamURL]);

    const submitDisplayName = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        if (!isValidTeamName) {
            return;
        }

        if (UseAnonymousURLs) {
            doCreateTeam();
            return;
        }

        const displayName = teamDisplayName;
        const newState = parentState;
        newState.wizard = 'team_url';
        newState.team!.display_name = displayName;
        newState.team!.name = cleanUpUrlable(displayName);
        setTeamURL(newState.team!.name);

        updateParent(newState);
    }, [isValidTeamName, UseAnonymousURLs, teamDisplayName, parentState, updateParent, doCreateTeam]);

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
                stopLoading();
                return false;
            }

            return true;
        },
        [actions, stopLoading],
    );

    const submitTeamUrl = useCallback(async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        const teamNameValid = await teamNameValidations(teamURL.trim());
        if (!teamNameValid) {
            stopLoading();
            return;
        }

        await doCreateTeam();
    }, [teamNameValidations, teamURL, doCreateTeam, stopLoading]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.currentTarget.select();
    }, []);

    const handleTeamURLInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamURL(e.target.value);
    }, []);

    const buttonText = useMemo(() => {
        const createMessage = (
            <FormattedMessage
                id='create_team.display_name.create'
                defaultMessage='Create'
            />
        );

        const finishMessage = (
            <FormattedMessage
                id='create_team.team_url.finish'
                defaultMessage='Finish'
            />
        );

        const loadingMessage = (
            <FormattedMessage
                id='create_team.team_url.creatingTeam'
                defaultMessage='Creating team...'
            />
        );

        const nextMessage = (
            <>
                <FormattedMessage
                    id='create_team.display_name.next'
                    defaultMessage='Next'
                />
                <i className='icon icon-chevron-right'/>
            </>
        );

        if (UseAnonymousURLs) {
            return isLoading ? loadingMessage : createMessage;
        }

        if (step === 'team_url') {
            return isLoading ? loadingMessage : finishMessage;
        }

        return nextMessage;
    }, [UseAnonymousURLs, isLoading, step]);

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
                buttonText={buttonText}
            />
        );
    }

    return (
        <DisplayNameStep
            teamDisplayName={teamDisplayName}
            isValidTeamName={isValidTeamName}
            onDisplayNameChange={handleDisplayNameChange}
            onSubmit={submitDisplayName}
            buttonText={buttonText}
            isLoading={isLoading}
            nameError={nameError}
        />
    );
}
