// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

import {UserProfile} from '@mattermost/types/users';

type Props = {
    user: UserProfile;
    removeUser: (user: UserProfile) => void;
    isDisabled?: boolean;
}

export default class UserGridRemove extends React.PureComponent<Props> {
    private handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        if (this.props.isDisabled) {
            return;
        }
        this.props.removeUser(this.props.user);
    }

    public render = (): JSX.Element => {
        const {isDisabled} = this.props;
        return (
            <div className='UserGrid_removeRow'>
                <a
                    onClick={this.handleClick}
                    href='#'
                    role='button'
                    className={isDisabled ? 'disabled' : ''}
                >
                    <FormattedMessage
                        id='admin.user_grid.remove'
                        defaultMessage='Remove'
                    />
                </a>
            </div>
        );
    }
}
