// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import * as GlobalActions from 'actions/global_actions';

import AboutBuildModal from 'components/about_build_modal';
import CommercialSupportModal from 'components/commercial_support_modal';
import Menu from 'components/widgets/menu/menu';

import {ModalIdentifiers} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import MenuItemBlockableLink from './menu_item_blockable_link';

type Props = {
    intl: IntlShape;
    locale: string;
    siteName?: string;
    navigationBlocked?: boolean;
    teams: Team[];
    actions: {
        deferNavigation: (onNavigationConfirmed: any) => any;
    };
    isLicensed: boolean;
    isCloud: boolean;
};

class AdminNavbarDropdown extends React.PureComponent<Props> {
    private handleLogout = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (this.props.navigationBlocked) {
            e.preventDefault();
            this.props.actions.deferNavigation(GlobalActions.emitUserLoggedOutEvent);
        } else {
            GlobalActions.emitUserLoggedOutEvent();
        }
    };

    render(): JSX.Element {
        const {locale, teams, siteName, isLicensed, isCloud} = this.props;
        const {formatMessage} = this.props.intl;
        const teamToRender = []; // Array of team components
        let switchTeams;
        if (teams && teams.length > 0) {
            const teamsArray = filterAndSortTeamsByDisplayName(teams, locale);

            for (const team of teamsArray) {
                teamToRender.push(
                    <MenuItemBlockableLink
                        key={'team_' + team.name}
                        to={'/' + team.name}
                        text={formatMessage({id: 'navbar_dropdown.switchTo', defaultMessage: 'Switch to '}) + ' ' + team.display_name}
                    />,
                );
            }
        } else {
            switchTeams = (
                <MenuItemBlockableLink
                    to={'/select_team'}
                    icon={
                        <i
                            className='fa fa-exchange'
                            title={formatMessage({
                                id: 'select_team.icon',
                                defaultMessage: 'Select Team Icon',
                            })}
                        />
                    }
                    text={formatMessage({id: 'admin.nav.switch', defaultMessage: 'Team Selection'})}
                />
            );
        }

        let commercialSupport = (
            <Menu.ItemExternalLink
                url='https://mattermost.com/support/'
                text={formatMessage({id: 'admin.nav.commercialSupport', defaultMessage: 'Commercial Support'})}
            />
        );

        if (isLicensed) {
            commercialSupport = (
                <Menu.ItemToggleModalRedux
                    modalId={ModalIdentifiers.COMMERCIAL_SUPPORT}
                    dialogType={CommercialSupportModal}
                    text={formatMessage({id: 'admin.nav.commercialSupport', defaultMessage: 'Commercial Support'})}
                />
            );
        }

        let adminGuideLink = 'https://docs.mattermost.com/guides/administration.html';
        if (isCloud) {
            adminGuideLink = 'https://docs.mattermost.com/guides/administration.html#cloud-workspace-management';
        }

        return (
            <Menu ariaLabel={formatMessage({id: 'admin.nav.menuAriaLabel', defaultMessage: 'Admin Console Menu'})}>
                <Menu.Group>
                    {teamToRender}
                    {switchTeams}
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemExternalLink
                        url={adminGuideLink}
                        text={formatMessage({id: 'admin.nav.administratorsGuide', defaultMessage: 'Administrator Guide'})}
                    />
                    <Menu.ItemExternalLink
                        url={'https://forum.mattermost.com/t/how-to-use-the-troubleshooting-forum/150'}
                        text={formatMessage({id: 'admin.nav.troubleshootingForum', defaultMessage: 'Troubleshooting Forum'})}
                    />
                    {commercialSupport}
                    <Menu.ItemToggleModalRedux
                        modalId={ModalIdentifiers.ABOUT}
                        dialogType={AboutBuildModal}
                        text={formatMessage({id: 'navbar_dropdown.about', defaultMessage: 'About {appTitle}'}, {appTitle: siteName || 'Mattermost'})}
                    />
                </Menu.Group>
                <Menu.Group>
                    <Menu.ItemAction
                        onClick={this.handleLogout}
                        text={formatMessage({id: 'navbar_dropdown.logout', defaultMessage: 'Log Out'})}
                    />
                </Menu.Group>
            </Menu>
        );
    }
}

export default injectIntl(AdminNavbarDropdown);
