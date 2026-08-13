// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import Input from 'components/widgets/inputs/input/input';

import logoImage from 'images/logo.png';
import Constants from 'utils/constants';

export type Props = {
    teamDisplayName: string;
    isValidTeamName: boolean;
    onDisplayNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.MouseEvent) => void;
    buttonText: ReactNode;
    isLoading?: boolean;
    nameError: string | JSX.Element;
};

export default function DisplayNameStep({teamDisplayName, isValidTeamName, onDisplayNameChange, onSubmit, buttonText, isLoading, nameError}: Props) {
    let nameErrorLabel = null;
    let nameDivClass = 'form-group';
    if (nameError) {
        nameErrorLabel = (
            <label
                role='alert'
                className='control-label'
                id='teamNameInputError'
            >
                {nameError}
            </label>
        );
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
                <label htmlFor='teamNameInput'>
                    <FormattedMessage
                        id='create_team.display_name.teamName'
                        tagName='strong'
                        defaultMessage='Team Name'
                    />
                </label>
                <div className={nameDivClass}>
                    <div className='row'>
                        <div className='col-sm-9'>
                            <Input
                                id='teamNameInput'
                                name='teamNameInput'
                                type='text'
                                value={teamDisplayName}
                                autoFocus={true}
                                onChange={onDisplayNameChange}
                                required={true}
                                maxLength={Constants.MAX_TEAMNAME_LENGTH}
                                minLength={Constants.MIN_TEAMNAME_LENGTH}
                                spellCheck='false'
                                hasError={Boolean(nameError)}
                            />
                        </div>
                    </div>
                    {nameErrorLabel}
                </div>
                <div>
                    <FormattedMessage
                        id='create_team.display_name.nameHelp'
                        defaultMessage='Name your team in any language. Your team name shows in menus and headings.'
                    />
                </div>
                <Button
                    id='teamNameNextButton'
                    type='submit'
                    emphasis='primary'
                    className='mt-8'
                    onClick={onSubmit}
                    disabled={!isValidTeamName || isLoading}
                >
                    {buttonText}
                </Button>
            </form>
        </div>
    );
}
