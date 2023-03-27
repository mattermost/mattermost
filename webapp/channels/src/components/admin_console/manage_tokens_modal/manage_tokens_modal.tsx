// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';
import {UserAccessToken, UserProfile} from '@mattermost/types/users';
import {ActionFunc} from 'mattermost-redux/types/actions';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import RevokeTokenButton from 'components/admin_console/revoke_token_button';
import LoadingScreen from 'components/loading_screen';
import Avatar from 'components/widgets/users/avatar';
import ExternalLink from 'components/external_link';

export type Props = {

    /**
     * Set to render the modal
     */
    show: boolean;

    /**
     * The user the roles are being managed for
     */
    user?: UserProfile;

    /**
     * The personal access tokens for a user, object with token ids as keys
     */
    userAccessTokens?: Record<string, UserAccessToken>;

    /**
     * Function called when modal is dismissed
     */
    onModalDismissed: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    actions: {

        /**
         * Function to get a user's access tokens
         */
        getUserAccessTokensForUser: (userId: string, page: number, perPage: number) => ActionFunc;
    };
};

type State = {
    error: string | null;
}

export default class ManageTokensModal extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {
            error: null,
        };
    }

    public componentDidUpdate(prevProps: Props): void {
        const userId = this.props.user ? this.props.user.id : null;
        const prevUserId = prevProps.user ? prevProps.user.id : null;
        if (userId && prevUserId !== userId) {
            this.props.actions.getUserAccessTokensForUser(userId, 0, 200);
        }
    }

    private handleError = (error: string): void => {
        this.setState({
            error,
        });
    }

    private renderContents = (): JSX.Element => {
        const {user, userAccessTokens} = this.props;

        if (!user) {
            return <LoadingScreen/>;
        }

        let name = UserUtils.getFullName(user);
        if (name) {
            name += ` (@${user.username})`;
        } else {
            name = `@${user.username}`;
        }

        let tokenList;
        if (userAccessTokens) {
            const userAccessTokensList = Object.values(userAccessTokens);

            if (userAccessTokensList.length === 0) {
                tokenList = (
                    <div className='manage-row__empty'>
                        <FormattedMessage
                            id='admin.manage_tokens.userAccessTokensNone'
                            defaultMessage='No personal access tokens.'
                        />
                    </div>
                );
            } else {
                tokenList = userAccessTokensList.map((token: UserAccessToken) => {
                    return (
                        <div
                            key={token.id}
                            className='manage-teams__team'
                        >
                            <div className='manage-teams__team-name'>
                                <div className='whitespace--nowrap overflow--ellipsis'>
                                    <FormattedMessage
                                        id='admin.manage_tokens.userAccessTokensNameLabel'
                                        defaultMessage='Token Description: '
                                    />
                                    {token.description}
                                </div>
                                <div className='whitespace--nowrap overflow--ellipsis'>
                                    <FormattedMessage
                                        id='admin.manage_tokens.userAccessTokensIdLabel'
                                        defaultMessage='Token ID: '
                                    />
                                    {token.id}
                                </div>
                            </div>
                            <div className='manage-teams__team-actions'>
                                <RevokeTokenButton
                                    tokenId={token.id}
                                    onError={this.handleError}
                                />
                            </div>
                        </div>
                    );
                });
            }
        } else {
            tokenList = <LoadingScreen/>;
        }

        return (
            <div>
                <div className='manage-teams__user'>
                    <Avatar
                        username={user.username}
                        url={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        size='lg'
                    />
                    <div className='manage-teams__info'>
                        <div className='manage-teams__name'>
                            {name}
                        </div>
                        <div className='manage-teams__email'>
                            {user.email}
                        </div>
                    </div>
                </div>
                <div className='pt-3'>
                    <FormattedMessage
                        id='admin.manage_tokens.userAccessTokensDescription'
                        defaultMessage='Personal access tokens function similarly to session tokens and can be used by integrations to <linkAuthentication>interact with this Mattermost server</linkAuthentication>. Tokens are disabled if the user is deactivated. Learn more about <linkPersonalAccessTokens>personal access tokens</linkPersonalAccessTokens>.'
                        values={{
                            linkAuthentication: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://api.mattermost.com/#tag/authentication'
                                    location='manage_tokens_modal'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkPersonalAccessTokens: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-personal-access-token/'
                                    location='manage_tokens_modal'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
                <div className='manage-teams__teams'>
                    {tokenList}
                </div>
            </div>
        );
    }

    public render = (): JSX.Element => {
        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onModalDismissed}
                dialogClassName='a11y__modal manage-teams'
                role='dialog'
                aria-labelledby='manageTokensModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='manageTokensModalLabel'
                    >
                        <FormattedMessage
                            id='admin.manage_tokens.manageTokensTitle'
                            defaultMessage='Manage Personal Access Tokens'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.renderContents()}
                    {this.state.error}
                </Modal.Body>
            </Modal>
        );
    }
}
