// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import uniqWith from 'lodash/uniqWith';
import React, {useEffect, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';
import type {Post} from '@mattermost/types/posts';
import {isArrayOf, isRecordOf} from '@mattermost/types/utilities';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import {fetchListing, installPlugin} from 'actions/marketplace';
import {getError, getInstalledListing, getInstalling, getPlugins} from 'selectors/views/marketplace';

import Markdown from 'components/markdown';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import ToggleModalButton from 'components/toggle_modal_button';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

// We only define the props used in this component for
// clarity. If more props are needed in the future,
// feel free to add them.
type PluginRequest = {
    user_id: string;
}

function isPluginRequest(v: unknown): v is PluginRequest {
    if (typeof v !== 'object' || v === null) {
        return false;
    }

    const request = v as PluginRequest;

    if (typeof request.user_id !== 'string') {
        return false;
    }

    return true;
}

type RequestedPlugins = Record<string, PluginRequest[]>

export type CustomPostProps = {
    requested_plugins_by_plugin_ids: RequestedPlugins;
    requested_plugins_by_user_ids: RequestedPlugins;
}

export function isCustomPostProps(v: unknown): v is CustomPostProps {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    const props = v as CustomPostProps;

    if (!isRecordOf(props.requested_plugins_by_plugin_ids, (e) => isArrayOf(e, isPluginRequest))) {
        return false;
    }

    if (!isRecordOf(props.requested_plugins_by_user_ids, (e) => isArrayOf(e, isPluginRequest))) {
        return false;
    }

    return true;
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
                defaultMessage={'Install {plugin}'}
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
                    defaultMessage={'Configure {plugin}'}
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

    const postProps = isCustomPostProps(props.post.props) ? props.post.props : undefined;
    const requestedPluginsByPluginIds = postProps?.requested_plugins_by_plugin_ids;
    const requestedPluginsByUserIds = postProps?.requested_plugins_by_user_ids;

    const userProfiles = useSelector(getUsers);
    const marketplacePlugins: MarketplacePlugin[] = useSelector(getPlugins);
    const marketplacePluginsNamesById = useMemo(() => {
        return marketplacePlugins.reduce<Record<string, string>>((acc, v) => {
            acc[v.manifest.id] = v.manifest.name;
            return acc;
        }, {});
    }, [marketplacePlugins]);

    const getUserIdsForUsersThatRequestedFeature = (requests: PluginRequest[]): string[] => requests.map((request: PluginRequest) => request.user_id);

    useEffect(() => {
        if (!marketplacePlugins.length) {
            dispatch(fetchListing());
        }
    }, [dispatch, marketplacePlugins.length]);

    useEffect(() => {
        // process the plugins once the marketplace plugins are fetched and the plugins are available from the props
        if (requestedPluginsByPluginIds && marketplacePlugins.length) {
            for (const pluginId of Object.keys(requestedPluginsByPluginIds)) {
                dispatch(getMissingProfilesByIds(getUserIdsForUsersThatRequestedFeature(requestedPluginsByPluginIds[pluginId])));
            }
        }
    }, [dispatch, marketplacePlugins, requestedPluginsByPluginIds]);

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
    const pluginIds = Object.keys(requestedPluginsByPluginIds || {});
    if (pluginIds.length && requestedPluginsByUserIds && requestedPluginsByPluginIds) {
        let post;
        const messageBuilder: string[] = [];
        const userIds = Object.keys(requestedPluginsByUserIds);
        if (userIds.length === 1 && pluginIds.length === 1) {
            const pluginName = marketplacePluginsNamesById[pluginIds[0]];
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
            post = (
                <ul
                    style={usersListStyle}
                    key={pluginIds.join('')}
                >
                    {pluginIds.map((pluginId) => {
                        const plugins = requestedPluginsByPluginIds[pluginId];
                        const pluginName = marketplacePluginsNamesById[pluginId];
                        const uniqueUserRequestsForPlugins = uniqWith(plugins, (one, two) => one.user_id === two.user_id);
                        const installRequests = [];
                        installRequests.push(createUsernameMessage(uniqueUserRequestsForPlugins));
                        installRequests.push(' ' + formatMessage({id: 'postypes.custom_open_plugin_install_post_rendered.plugin_request', defaultMessage: 'requested installing the {pluginRequests} app.'}, {pluginRequests: pluginName}));

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
                                    pluginName={pluginName}
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
