// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import LoadingScreen from 'components/loading_screen';

import UserListRow from './user_list_row';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {ReactNode} from 'react';

type Props = {
    rowComponentType?: React.ComponentType<any>;
    length?: number;
    actions?: ReactNode[];
    actionUserProps?: {
        [userId: string]: {
            channel?: Channel;
            teamMember: TeamMembership;
            channelMember?: ChannelMembership;
        };
    };
    isDisabled?: boolean;
    users?: UserProfile[] | null;
    extraInfo?: {[key: string]: Array<string | JSX.Element>};
    actionProps?: {
        mfaEnabled: boolean;
        enableUserAccessTokens: boolean;
        experimentalEnableAuthenticationTransfer: boolean;
        doPasswordReset: (user: UserProfile) => void;
        doEmailReset: (user: UserProfile) => void;
        doManageTeams: (user: UserProfile) => void;
        doManageRoles: (user: UserProfile) => void;
        doManageTokens: (user: UserProfile) => void;
        isDisabled?: boolean;
    };
}

export default class UserList extends React.PureComponent <Props> {
    static defaultProps = {
        users: [],
        extraInfo: {},
        actions: [],
        actionProps: {},
        rowComponentType: UserListRow,
    };
    containerRef: React.RefObject<any>;

    constructor(props: Props) {
        super(props);
        this.containerRef = React.createRef();
    }

    scrollToTop = () => {
        if (this.containerRef.current) {
            this.containerRef.current.scrollTop = 0;
        }
    };

    render() {
        const users = this.props.users;
        const RowComponentType = this.props.rowComponentType;

        let content;
        if (users == null) {
            return <LoadingScreen/>;
        } else if (users.length > 0 && RowComponentType && this.props.actionProps) {
            content = users.map((user: UserProfile, index: number) => {
                const {actionUserProps, extraInfo} = this.props;
                const userId = user.id;
                return (
                    <RowComponentType
                        key={user.id}
                        user={user}
                        extraInfo={extraInfo?.[userId]}
                        actions={this.props.actions}
                        actionProps={this.props.actionProps}
                        actionUserProps={actionUserProps?.[userId]}
                        index={index}
                        totalUsers={users.length}
                        userCount={index >= 0 ? index : -1}
                        isDisabled={this.props.isDisabled}
                    />
                );
            });
        } else {
            content = (
                <div
                    key='no-users-found'
                    className='more-modal__placeholder-row'
                    data-testid='noUsersFound'
                >
                    <p>
                        <FormattedMessage
                            id='user_list.notFound'
                            defaultMessage='No users found'
                        />
                    </p>
                </div>
            );
        }

        return (
            <div ref={this.containerRef}>
                {content}
            </div>
        );
    }
}
