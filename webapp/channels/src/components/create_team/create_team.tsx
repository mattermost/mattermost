// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Route, Switch, Redirect} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';
import type {CloudUsage} from '@mattermost/types/cloud';
import type {Team} from '@mattermost/types/teams';

import AnnouncementBar from 'components/announcement_bar';
import BackButton from 'components/common/back_button';
import SiteNameAndDescription from 'components/common/site_name_and_description';
import DisplayName from 'components/create_team/components/display_name';
import TeamUrl from 'components/create_team/components/team_url';

export type Props = {

    /*
   * Object containing information on the current team, used to define BackButton's url
   */
    currentTeam?: Team;

    /*
   * Object containing information on the current selected channel, used to define BackButton's url
   */
    currentChannel?: Channel;

    /*
    * String containing the custom branding's text
    */
    customDescriptionText?: string;

    /*
   * String containing the custom branding's Site Name
   */
    siteName?: string;

    /*
   * Object from react-router
   */
    match: {
        url: string;
    };

    isCloud: boolean;
    isFreeTrial: boolean;
    usageDeltas: CloudUsage;
};

type State = {
    team?: Partial<Team>;
    wizard: string;
};

export default class CreateTeam extends React.PureComponent<Props & RouteComponentProps, State> {
    public constructor(props: Props & RouteComponentProps) {
        super(props);

        this.state = {
            team: {},
            wizard: 'display_name',
        };
    }

    public updateParent = (state: State) => {
        this.setState(state);
        this.props.history.push('/create_team/' + state.wizard);
    };

    render() {
        const {
            currentChannel,
            currentTeam,
            customDescriptionText,
            match,
            siteName,
            isCloud,
            isFreeTrial,
            usageDeltas: {
                teams: {
                    active: usageDeltaTeams,
                },
            },
        } = this.props;

        const teamsLimitReached = usageDeltaTeams >= 0;
        const createTeamRestricted = isCloud && !isFreeTrial && teamsLimitReached;

        let url = '/select_team';
        if (currentTeam) {
            url = `/${currentTeam.name}`;
            if (currentChannel) {
                url += `/channels/${currentChannel.name}`;
            }
        }

        return (
            <div>
                <AnnouncementBar/>
                <BackButton url={url}/>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <SiteNameAndDescription
                            customDescriptionText={customDescriptionText}
                            siteName={siteName}
                        />
                        <div className='signup__content'>
                            {createTeamRestricted ? (
                                <>
                                    <h5>
                                        <FormattedMessage
                                            id='create_team.createTeamRestricted.title'
                                            tagName='strong'
                                            defaultMessage='Professional feature'
                                        />
                                    </h5>
                                    <div>
                                        <FormattedMessage
                                            id='create_team.createTeamRestricted.message'
                                            defaultMessage='Your workspace plan has reached the limit on the number of teams. Create unlimited teams with a free 30-day trial. Contact your System Administrator.'
                                        />
                                    </div>
                                </>
                            ) : (
                                <Switch>
                                    <Route
                                        path={`${this.props.match.url}/display_name`}
                                        render={(props) => (
                                            <DisplayName
                                                state={this.state}
                                                updateParent={this.updateParent}
                                                {...props}
                                            />
                                        )}
                                    />
                                    <Route
                                        path={`${this.props.match.url}/team_url`}
                                        render={(props) => (
                                            <TeamUrl
                                                state={this.state}
                                                updateParent={this.updateParent}
                                                {...props}
                                            />
                                        )}
                                    />
                                    <Redirect to={`${match.url}/display_name`}/>
                                </Switch>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
