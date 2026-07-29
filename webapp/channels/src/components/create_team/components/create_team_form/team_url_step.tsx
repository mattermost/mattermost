// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import logoImage from 'images/logo.png';
import {getSiteURL} from 'utils/url';

export type Props = {
    teamURL?: string;
    nameError: string | JSX.Element;
    isLoading: boolean;
    teamURLInput: React.RefObject<HTMLInputElement>;
    onTeamURLChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    onBack: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
    buttonText: ReactNode;
};

export default function TeamUrlStep({teamURL, nameError, isLoading, teamURLInput, onTeamURLChange, onFocus, onSubmit, onBack, buttonText}: Props) {
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

    const title = `${getSiteURL()}/`;

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
                                    onFocus={onFocus}
                                    onChange={onTeamURLChange}
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
                        emphasis='primary'
                        disabled={isLoading}
                        onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onSubmit(e)}
                    >
                        {buttonText}
                    </Button>
                </div>
                <div className='mt-8'>
                    <a
                        href='#'
                        onClick={onBack}
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
