// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ChevronRightIcon} from '@mattermost/compass-icons/components';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {deferNavigation} from 'actions/admin_actions';
import * as GlobalActions from 'actions/global_actions';
import {openModal} from 'actions/views/modals';
import {getCurrentLocale} from 'selectors/i18n';
import {getNavigationBlocked} from 'selectors/views/admin';

import AboutBuildModal from 'components/about_build_modal';
import CommercialSupportModal from 'components/commercial_support_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import type {GlobalState} from 'types/store';

const AdminNavbarDropdown = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const locale = useSelector(getCurrentLocale);
    const teams = useSelector(getMyTeams);
    const siteName = useSelector((state: GlobalState) => getConfig(state).SiteName);
    const navigationBlocked = useSelector(getNavigationBlocked);
    const license = useSelector(getLicense);
    const isLicensed = license.IsLicensed === 'true';
    const isCloud = license.Cloud === 'true';

    const sortedTeams = useMemo(
        () => filterAndSortTeamsByDisplayName(teams, locale),
        [teams, locale],
    );

    const handleLogout = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
        if (navigationBlocked) {
            e.preventDefault();
            dispatch(deferNavigation(GlobalActions.emitUserLoggedOutEvent));
        } else {
            GlobalActions.emitUserLoggedOutEvent();
        }
    }, [dispatch, navigationBlocked]);

    const handleOpenExternalLink = useCallback((url: string) => {
        window.open(url, '_blank', 'noopener noreferrer');
    }, []);

    const handleCommercialSupport = useCallback(() => {
        if (isLicensed) {
            dispatch(openModal({
                modalId: ModalIdentifiers.COMMERCIAL_SUPPORT,
                dialogType: CommercialSupportModal,
            }));
            return;
        }

        handleOpenExternalLink('https://mattermost.com/support/');
    }, [dispatch, handleOpenExternalLink, isLicensed]);

    const handleAbout = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ABOUT,
            dialogType: AboutBuildModal,
        }));
    }, [dispatch]);

    const adminGuideLink = isCloud ?
        'https://docs.mattermost.com/guides/administration.html#cloud-workspace-management' :
        'https://docs.mattermost.com/guides/administration.html';

    let switchTeamsMenuItem = null;
    if (sortedTeams.length === 0) {
        switchTeamsMenuItem = (
            <Menu.LinkItem
                id='adminConsoleSwitchTeams'
                to='/select_team'
                labels={
                    <FormattedMessage
                        id='admin.nav.switch'
                        defaultMessage='Team Selection'
                    />
                }
            />
        );
    } else if (sortedTeams.length > 1) {
        switchTeamsMenuItem = (
            <Menu.SubMenu
                id='adminConsoleSwitchTeams'
                labels={
                    <FormattedMessage
                        id='admin.nav.switchTeams'
                        defaultMessage='Switch teams'
                    />
                }
                trailingElements={<ChevronRightIcon size={16}/>}
                menuId='adminConsoleSwitchTeamsMenu'
                menuAriaLabel={formatMessage({id: 'admin.nav.switchTeams', defaultMessage: 'Switch teams'})}
            >
                {sortedTeams.map((team) => (
                    <Menu.LinkItem
                        key={'team_' + team.name}
                        id={'switchTo_' + team.name}
                        to={'/' + team.name}
                        labels={<span>{team.display_name}</span>}
                    />
                ))}
            </Menu.SubMenu>
        );
    }

    return (
        <>
            {switchTeamsMenuItem}
            {switchTeamsMenuItem && <Menu.Separator/>}
            <Menu.Item
                id='adminConsoleAdministratorsGuide'
                onClick={() => handleOpenExternalLink(adminGuideLink)}
                labels={
                    <FormattedMessage
                        id='admin.nav.administratorsGuide'
                        defaultMessage="Administrator's Guide"
                    />
                }
            />
            <Menu.Item
                id='adminConsoleTroubleshootingForum'
                onClick={() => handleOpenExternalLink('https://forum.mattermost.com/t/how-to-use-the-troubleshooting-forum/150')}
                labels={
                    <FormattedMessage
                        id='admin.nav.troubleshootingForum'
                        defaultMessage='Troubleshooting Forum'
                    />
                }
            />
            <Menu.Item
                id='adminConsoleCommercialSupport'
                onClick={handleCommercialSupport}
                labels={
                    <FormattedMessage
                        id='admin.nav.commercialSupport'
                        defaultMessage='Commercial Support'
                    />
                }
            />
            <Menu.Item
                id='adminConsoleAbout'
                onClick={handleAbout}
                labels={
                    <FormattedMessage
                        id='navbar_dropdown.about'
                        defaultMessage='About {appTitle}'
                        values={{appTitle: siteName || 'Mattermost'}}
                    />
                }
            />
            <Menu.Separator/>
            <Menu.Item
                id='adminConsoleLogout'
                onClick={handleLogout}
                labels={
                    <FormattedMessage
                        id='navbar_dropdown.logout'
                        defaultMessage='Log Out'
                    />
                }
            />
        </>
    );
};

export default AdminNavbarDropdown;
