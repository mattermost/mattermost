// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Route, Switch, Redirect} from 'react-router-dom';

import AddCommand from 'components/integrations/add_command';
import ConfirmIntegration from 'components/integrations/confirm_integration';
import EditCommand from 'components/integrations/edit_command';
import InstalledCommands from 'components/integrations/installed_commands';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

interface IProps {
    component: any;
    extraProps: {
        loading: boolean;
        commands: Command[];
        users?: RelationOneToOne<UserProfile, UserProfile>;
        team?: Team;
        user?: UserProfile;
    };
    path: string;
}

const CommandRoute = ({component: Component, extraProps, ...rest}: IProps) => (
    <Route
        {...rest}
        render={(props) => (
            <Component
                {...extraProps}
                {...props}
            />
        )}
    />
);

type Props = {

    /**
     * The team data needed to pass into child components
     */
    team?: Team;

    /**
     * The user data needed to pass into child components
     */
    user?: UserProfile;

    /**
     * The users collection
     */
    users?: RelationOneToOne<UserProfile, UserProfile>;

    /**
     * Installed slash commands to display
     */
    commands: Command[];

    /**
     * Object from react-router
     */
    match: {
        url: string;
    };

    actions: {

        /**
         * The function to call to fetch team commands
         */
        loadCommandsAndProfilesForTeam: (teamId?: string) => any; // TechDebt-TODO: This needs to be changed to 'Promise<void>'
    };

    /**
     * Whether or not commands are enabled.
     */
    enableCommands?: boolean;
};

type State = {
    loading: boolean;
};

export default class CommandsContainer extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
        };
    }

    componentDidMount() {
        if (this.props.enableCommands) {
            this.props.actions.loadCommandsAndProfilesForTeam(this.props.team?.id).then(
                () => this.setState({loading: false}),
            );
        }
    }

    render() {
        const extraProps = {
            loading: this.state.loading,
            commands: this.props.commands || [],
            users: this.props.users,
            team: this.props.team,
            user: this.props.user,
        };
        return (
            <div>
                <Switch>
                    <Route
                        exact={true}
                        path={`${this.props.match.url}/`}
                        render={() => (<Redirect to={`${this.props.match.url}/installed`}/>)}
                    />
                    <CommandRoute
                        extraProps={extraProps}
                        path={`${this.props.match.url}/installed`}
                        component={InstalledCommands}
                    />
                    <CommandRoute
                        extraProps={extraProps}
                        path={`${this.props.match.url}/add`}
                        component={AddCommand}
                    />
                    <CommandRoute
                        extraProps={extraProps}
                        path={`${this.props.match.url}/edit`}
                        component={EditCommand}
                    />
                    <CommandRoute
                        extraProps={extraProps}
                        path={`${this.props.match.url}/confirm`}
                        component={ConfirmIntegration}
                    />
                </Switch>
            </div>
        );
    }
}
