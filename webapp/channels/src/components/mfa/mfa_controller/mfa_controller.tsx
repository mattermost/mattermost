// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Route, Switch} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import BackButton from 'components/common/back_button';
import LogoutIcon from 'components/widgets/icons/fa_logout_icon';

import logoImage from 'images/logo.png';

import Confirm from '../confirm';
import Setup from '../setup';

type Location = {
    search: string;
}

type Props = {
    location: Location;
    children?: React.ReactNode;
    mfa: boolean;
    enableMultifactorAuthentication: boolean;
    enforceMultifactorAuthentication: boolean;

    /*
     * Object from react-router
     */
    match: {
        url: string;
    };
}

type State = {
    enforceMultifactorAuthentication: boolean;
}

export default class MFAController extends React.PureComponent<Props & RouteComponentProps, State> {
    public constructor(props: Props & RouteComponentProps) {
        super(props);

        this.state = {enforceMultifactorAuthentication: props.enableMultifactorAuthentication};
    }

    public componentDidMount(): void {
        document.body.classList.add('sticky');
        document.getElementById('root')!.classList.add('container-fluid');

        if (!this.props.enableMultifactorAuthentication) {
            this.props.history.push('/');
        }
    }

    public componentWillUnmount(): void {
        document.body.classList.remove('sticky');
        document.getElementById('root')!.classList.remove('container-fluid');
    }

    public handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        emitUserLoggedOutEvent('/login');
    };

    public updateParent = (state: State): void => {
        this.setState(state);
    };

    public render(): JSX.Element {
        let backButton;
        if (this.props.mfa && this.props.enforceMultifactorAuthentication) {
            backButton = (
                <div className='signup-header'>
                    <button
                        className='style--none color--link'
                        onClick={this.handleOnClick}
                    >
                        <LogoutIcon/>
                        <FormattedMessage
                            id='web.header.logout'
                            defaultMessage='Logout'
                        />
                    </button>
                </div>
            );
        } else {
            backButton = (<BackButton/>);
        }

        return (
            <div className='inner-wrap'>
                <div className='row content'>
                    <div>
                        {backButton}
                        <div className='col-sm-12'>
                            <div className='signup-team__container'>
                                <h3>
                                    <FormattedMessage
                                        id='mfa.setupTitle'
                                        defaultMessage='Multi-factor Authentication Setup'
                                    />
                                </h3>
                                <img
                                    alt={'signup team logo'}
                                    className='signup-team-logo'
                                    src={logoImage}
                                />
                                <div id='mfa'>
                                    <Switch>
                                        <Route
                                            path={`${this.props.match.url}/setup`}
                                            render={(props) => (
                                                <Setup
                                                    state={this.state}
                                                    updateParent={this.updateParent}
                                                    {...props}
                                                />
                                            )}
                                        />
                                        <Route
                                            path={`${this.props.match.url}/confirm`}
                                            render={() => (
                                                <Confirm/>
                                            )}
                                        />
                                    </Switch>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
