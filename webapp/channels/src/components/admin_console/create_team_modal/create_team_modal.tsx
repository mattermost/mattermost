// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {GenericModal} from '@mattermost/components';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ExternalLink from 'components/external_link';
import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import '../admin_modal_with_input.scss';

type Props = {
    onExited: () => void;
    actions: {
        createTeam: (team: Team) => Promise<ActionResult<Team>>;
        checkIfTeamExists: (teamName: string) => Promise<ActionResult<boolean>>;
    };
}

export default function CreateTeamModal({
    onExited,
    actions,
}: Props) {
    const {formatMessage} = useIntl();
    const history = useHistory();

    const [show, setShow] = useState(true);
    const [displayName, setDisplayName] = useState('');
    const [teamUrl, setTeamUrl] = useState('');
    const [urlEdited, setUrlEdited] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState<React.ReactNode>(null);
    const [displayNameError, setDisplayNameError] = useState<React.ReactNode>(null);
    const [urlError, setUrlError] = useState<React.ReactNode>(null);

    const handleCancel = useCallback(() => {
        setShow(false);
    }, []);

    const handleDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setDisplayName(value);
        if (!urlEdited) {
            setTeamUrl(cleanUpUrlable(value));
        }
    }, [urlEdited]);

    const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUrlEdited(true);
        setTeamUrl(e.target.value);
    }, []);

    const validateUrl = useCallback(async (name: string): Promise<boolean> => {
        const cleanedName = cleanUpUrlable(name);
        const urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;

        if (!name) {
            setUrlError(
                <FormattedMessage
                    id='create_team.team_url.required'
                    defaultMessage='This field is required'
                />,
            );
            return false;
        }

        if (cleanedName.length < Constants.MIN_TEAMNAME_LENGTH || cleanedName.length > Constants.MAX_TEAMNAME_LENGTH) {
            setUrlError(
                <FormattedMessage
                    id='create_team.team_url.charLength'
                    defaultMessage='Name must be {min} or more characters up to a maximum of {max}'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />,
            );
            return false;
        }

        if (cleanedName !== name || !urlRegex.test(name)) {
            setUrlError(
                <FormattedMessage
                    id='create_team.team_url.regex'
                    defaultMessage="Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash."
                />,
            );
            return false;
        }

        for (const reserved of Constants.RESERVED_TEAM_NAMES) {
            if (cleanedName.indexOf(reserved) === 0) {
                setUrlError(
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

        const {data: exists} = await actions.checkIfTeamExists(name);
        if (exists) {
            setUrlError(
                <FormattedMessage
                    id='create_team.team_url.unavailable'
                    defaultMessage='This URL is taken or unavailable. Please try another.'
                />,
            );
            return false;
        }

        return true;
    }, [actions]);

    const handleConfirm = useCallback(async () => {
        if (saving) {
            return;
        }

        setError(null);
        setDisplayNameError(null);
        setUrlError(null);

        const trimmedDisplayName = displayName.trim();
        if (trimmedDisplayName.length < Constants.MIN_TEAMNAME_LENGTH || trimmedDisplayName.length > Constants.MAX_TEAMNAME_LENGTH) {
            setDisplayNameError(
                <FormattedMessage
                    id='create_team.team_url.charLength'
                    defaultMessage='Name must be {min} or more characters up to a maximum of {max}'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />,
            );
            return;
        }

        const trimmedUrl = teamUrl.trim();

        setSaving(true);

        const urlValid = await validateUrl(trimmedUrl);
        if (!urlValid) {
            setSaving(false);
            return;
        }

        const result = await actions.createTeam({
            type: 'O',
            display_name: trimmedDisplayName,
            name: trimmedUrl,
        } as Team);

        if ('error' in result && result.error) {
            setError(result.error.message);
            setSaving(false);
            return;
        }

        const created = result.data;
        setShow(false);
        if (created) {
            history.push(`/admin_console/user_management/teams/${created.id}`);
        }
    }, [saving, displayName, teamUrl, validateUrl, actions, history]);

    return (
        <GenericModal
            id='createTeamModal'
            className='CreateTeamModal'
            modalHeaderText={formatMessage({
                id: 'admin.create_team.title',
                defaultMessage: 'Create team',
            })}
            show={show}
            onExited={onExited}
            onHide={handleCancel}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            confirmButtonText={formatMessage({
                id: 'admin.create_team.createButton',
                defaultMessage: 'Create team',
            })}
            isConfirmDisabled={saving}
            compassDesign={true}
            autoCloseOnConfirmButton={false}
            errorText={error ? <span className='error'>{error}</span> : undefined}
            dataTestId='createTeamModal'
        >
            <div className='CreateTeamModal__body'>
                <Input
                    type='text'
                    name='teamDisplayName'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.create_team.displayName',
                        defaultMessage: 'Team name',
                    })}
                    placeholder={formatMessage({
                        id: 'admin.create_team.enterDisplayName',
                        defaultMessage: 'Enter team name',
                    })}
                    value={displayName}
                    onChange={handleDisplayNameChange}
                    autoFocus={true}
                    maxLength={Constants.MAX_TEAMNAME_LENGTH}
                    customMessage={displayNameError ? {type: 'error', value: displayNameError} : undefined}
                />
                <Input
                    type='text'
                    name='teamUrl'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.create_team.url',
                        defaultMessage: 'Team URL',
                    })}
                    placeholder={formatMessage({
                        id: 'admin.create_team.enterUrl',
                        defaultMessage: 'Enter team URL',
                    })}
                    value={teamUrl}
                    onChange={handleUrlChange}
                    maxLength={Constants.MAX_TEAMNAME_LENGTH}
                    customMessage={urlError ? {type: 'error', value: urlError} : undefined}
                />
            </div>
        </GenericModal>
    );
}
