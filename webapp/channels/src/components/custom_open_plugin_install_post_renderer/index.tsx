// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import {uniqWith} from 'lodash';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';
import type {Post} from '@mattermost/types/posts';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import {fetchListing, installPlugin} from 'actions/marketplace';
import {getError, getInstalledListing, getInstalling, getPlugins} from 'selectors/views/marketplace';

import Markdown from 'components/markdown';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import ToggleModalButton from 'components/toggle_modal_button';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type PluginRequest = {
    user_id: string;
    required_feature: string;
    required_plan: string;
    create_at: string;
    sent_at: string;
    plugin_name: string;
    plugin_id: string;
}

type RequestedPlugins = Record<string, PluginRequest[]>

type CustomPostProps = {
    requested_plugins_by_plugin_ids: RequestedPlugins;
    requested_plugins_by_user_ids: RequestedPlugins;
}

const usersListStyle = {
    margin: '20px 0',
};

const InstallLink = (props: {pluginId: string; pluginName: string}) => {
    const dispatch = useDispatch();

    return (
        <Link
            to='#'
            onClick={() => dispatch(installPlugin(props.pluginId))}
            style={{color: 'var(--denim-button-bg)', fontWeight: '600'}}
        >
            <FormattedMessage
                id='marketplace_modal.list.install.plugin'
                defaultMessage={`Install ${props.pluginName}`}
                values={{
                    plugin: props.pluginName,
                }}
            />
        </Link>
    );
};

const ConfigureLink = (props: {pluginId: string; pluginName: string}) => {
    return (
        <>
            <FormattedMessage
                id='postypes.custom_open_plugin_install_post_rendered.plugins_installed'
                defaultMessage={`${props.pluginName} is now installed.`}
                values={{
                    pluginName: props.pluginName,
                }}
            />
            {' '}
            <Link
                to={'/admin_console/plugins/plugin_' + props.pluginId}
                style={{color: 'var(--denim-button-bg)', fontWeight: '600'}}
            >
                <FormattedMessage
                    id='marketplace_modal.list.configure.plugin'
                    defaultMessage={`Configure ${props.pluginName}`}
                    values={{
                        plugin: props.pluginName,
                    }}
                />
            </Link>
        </>
    );
};

const InstallAndConfigureLink = (props: {pluginId: string; pluginName: string}) => {
    const installedListing = useSelector(getInstalledListing) as MarketplacePlugin[];
    const error = useSelector((state: GlobalState) => getError(state, props.pluginId));

    const isInstalled = installedListing.some((plugin) => plugin.manifest.id === props.pluginId);
    const installing = useSelector((state: GlobalState) => getInstalling(state, props.pluginId));
    if (installing) {
        return (
            <span style={{fontStyle: 'italic', color: 'var(--online-indicator)', fontWeight: '600'}}>
                <FormattedMessage
                    id='marketplace_modal.installing'
                    defaultMessage='Installing...'
                />
            </span>
        );
    } else if (!isInstalled && !error) {
        return (
            <InstallLink
                pluginId={props.pluginId}
                pluginName={props.pluginName}
            />);
    } else if (isInstalled && !error) {
        return (
            <ConfigureLink
                pluginId={props.pluginId}
                pluginName={props.pluginName}
            />);
    }
    return null;
};

export default function OpenPluginInstallPost(props: {post: Post}) {
    const customMessageBody = [];

    const dispatch = useDispatch();
    const {formatMessage, formatList} = useIntl();
    const [pluginsByPluginIds, setPluginsByPluginIds] = useState<RequestedPlugins>({});

    const postProps = props.post.props as CustomPostProps;
    const requestedPluginsByPluginIds = postProps?.requested_plugins_by_plugin_ids;
    const requestedPluginsByUserIds = postProps?.requested_plugins_by_user_ids;

    const userProfiles = useSelector(getUsers);
    const marketplacePlugins: MarketplacePlugin[] = useSelector(getPlugins);

    const getUserIdsForUsersThatRequestedFeature = (requests: PluginRequest[]): string[] => requests.map((request: PluginRequest) => request.user_id);

    useEffect(() => {
        if (!marketplacePlugins.length) {
            dispatch(fetchListing());
        }
    }, [dispatch, fetchListing, marketplacePlugins.length]);

    useEffect(() => {
        // process the plugins once the marketplace plugins are fetched and the plugins are available from the props
        if (requestedPluginsByPluginIds && marketplacePlugins.length && !Object.keys(pluginsByPluginIds).length) {
            const plugins = {} as RequestedPlugins;
            const mPlugins = marketplacePlugins.reduce((acc, mPlugin) => {
                return {
                    ...acc,
                    [mPlugin.manifest.id as keyof string]: mPlugin,
                };
            }, {}) as {[ key: string]: MarketplacePlugin};

            for (const pluginId of Object.keys(requestedPluginsByPluginIds)) {
                plugins[pluginId] = requestedPluginsByPluginIds[pluginId].map((currPlugin: PluginRequest) => {
                    return {
                        ...currPlugin,
                        plugin_name: mPlugins[pluginId].manifest.name || pluginId,
                        plugin_id: pluginId,
                    };
                });
                dispatch(getMissingProfilesByIds(getUserIdsForUsersThatRequestedFeature(requestedPluginsByPluginIds[pluginId])));
            }
            setPluginsByPluginIds(plugins);
        }
    }, [dispatch, marketplacePlugins, requestedPluginsByPluginIds, pluginsByPluginIds]);

    const createUsernameMessage = (requests: PluginRequest[]) => {
        if (requests.length >= 5) {
            return formatMessage({
                id: 'postypes.custom_open_pricing_modal_post_renderer.members',
                defaultMessage: '{members} members',
            }, {members: requests.length});
        }

        let usernameMessage;
        const users = getUserNamesForUsersThatRequestedFeature(requests);

        if (users.length === 1) {
            usernameMessage = users[0];
        } else {
            const lastUser = users.splice(-1, 1)[0];
            users.push(formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.and', defaultMessage: 'and'}) + ' ' + lastUser);
            usernameMessage = users.join(', ').replace(/,([^,]*)$/, '$1');
        }

        return usernameMessage;
    };
    const getUserNamesForUsersThatRequestedFeature = (requests: PluginRequest[]): string[] => {
        const userNames = requests.map((req: PluginRequest) => {
            return getUserNameForUser(req.user_id);
        });
        return userNames;
    };

    const getUserNameForUser = (userId: string) => {
        const unknownName = formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.unknown', defaultMessage: '@unknown'});
        const username = userProfiles[userId]?.username;
        return username ? '@' + username : unknownName;
    };

    const markDownOptions = {
        atSumOfMembersMentions: true,
        atPlanMentions: true,
        markdown: false,
    };
    const pluginIds = Object.keys(pluginsByPluginIds);
    if (pluginIds.length && requestedPluginsByUserIds) {
        let post;
        const messageBuilder: string[] = [];
        const userIds = Object.keys(requestedPluginsByUserIds);
        if (userIds.length === 1 && pluginIds.length === 1) {
            const pluginName = pluginsByPluginIds[pluginIds[0]][0].plugin_name;
            messageBuilder.push('@' + userProfiles[userIds[0]]?.username);
            messageBuilder.push(' ' + formatMessage({id: 'postypes.custom_open_plugin_install_post_rendered.plugin_request', defaultMessage: 'requested installing the {pluginRequests} app.'}, {pluginRequests: pluginName}));

            const instructions = (
                <FormattedMessage
                    id='postypes.custom_open_plugin_install_post_rendered.plugin_instructions'
                    defaultMessage='<pluginApp></pluginApp> or visit <marketplaceLink>Marketplace</marketplaceLink> to view all plugins.'
                    values={{
                        marketplaceLink: (text: string) => (
                            <ToggleModalButton
                                id='marketplaceModal'
                                className='color--link'
                                modalId={ModalIdentifiers.PLUGIN_MARKETPLACE}
                                dialogType={MarketplaceModal}
                            >
                                {text}
                            </ToggleModalButton>
                        ),
                        pluginApp: () => (
                            <InstallAndConfigureLink
                                pluginId={pluginIds[0]}
                                pluginName={pluginName}
                            />
                        ),
                    }}
                />);

            const message = formatList(messageBuilder, {style: 'narrow', type: 'unit'});
            post = (
                <>
                    <Markdown
                        postId={props.post.id}
                        message={message}
                        options={markDownOptions}
                        userIds={getUserIdsForUsersThatRequestedFeature(requestedPluginsByUserIds[userIds[0]])}
                    />
                    {' '}
                    {instructions}
                </>);
            customMessageBody.push(post);
        } else {
            messageBuilder.push(formatMessage({id: 'postypes.custom_open_plugin_install_post_rendered.app_installation_request_text', defaultMessage: 'You’ve received the following app installation requests:'}));
            const pluginIds = Object.keys(pluginsByPluginIds);

            post = (
                <ul
                    style={usersListStyle}
                    key={pluginIds.join('')}
                >
                    {pluginIds.map((pluginId) => {
                        const plugins = pluginsByPluginIds[pluginId];
                        const uniqueUserRequestsForPlugins = uniqWith(plugins, (one, two) => one.user_id === two.user_id);
                        const installRequests = [];
                        installRequests.push(createUsernameMessage(uniqueUserRequestsForPlugins));
                        installRequests.push(' ' + formatMessage({id: 'postypes.custom_open_plugin_install_post_rendered.plugin_request', defaultMessage: 'requested installing the {pluginRequests} app.'}, {pluginRequests: uniqueUserRequestsForPlugins[0].plugin_name}));

                        return (
                            <li key={pluginId}>
                                <Markdown
                                    postId={props.post.id}
                                    message={installRequests.join('')}
                                    options={markDownOptions}
                                    userIds={getUserIdsForUsersThatRequestedFeature(requestedPluginsByUserIds[userIds[0]])}
                                />
                                {' '}
                                <InstallAndConfigureLink
                                    pluginId={pluginId}
                                    pluginName={uniqueUserRequestsForPlugins[0].plugin_name}
                                />
                            </li>
                        );
                    })}
                </ul>
            );

            const instructions = (
                <FormattedMessage
                    id='postypes.custom_open_plugin_install_post_rendered.plugins_instructions'
                    defaultMessage='Install the apps or visit <marketplaceLink>Marketplace</marketplaceLink> to view all plugins.'
                    values={{
                        marketplaceLink: (text: string) => (
                            <ToggleModalButton
                                id='marketplaceModal'
                                className='color--link'
                                modalId={ModalIdentifiers.PLUGIN_MARKETPLACE}
                                dialogType={MarketplaceModal}
                                dialogProps={{openedFrom: 'open_plugin_install_post'}}
                            >
                                {text}
                            </ToggleModalButton>
                        ),
                    }}
                />);

            customMessageBody.push(messageBuilder);
            customMessageBody.push(post);
            customMessageBody.push(instructions);
        }
    }

    return (
        <div>
            {customMessageBody}
        </div>
    );
}
