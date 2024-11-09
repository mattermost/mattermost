// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry as PluginRegistryInterface, InternalPluginRegistry} from '@hmhealey/plugin-support';
import React from 'react';
import {isValidElementType} from 'react-is';

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import reducerRegistry from 'mattermost-redux/store/reducer_registry';

import {
    registerAdminConsolePlugin,
    unregisterAdminConsolePlugin,
    registerAdminConsoleCustomSetting,
    registerAdminConsoleCustomSection,
} from 'actions/admin_actions';
import {showRHSPlugin, hideRHSPlugin, toggleRHSPlugin} from 'actions/views/rhs';
import {
    registerPluginTranslationsSource,
} from 'actions/views/root';
import {
    registerPluginWebSocketEvent,
    unregisterPluginWebSocketEvent,
    registerPluginReconnectHandler,
    unregisterPluginReconnectHandler,
} from 'actions/websocket_actions.jsx';
import store from 'stores/redux_store';

import {ActionTypes} from 'utils/constants';
import {reArg} from 'utils/func';
import {generateId} from 'utils/utils';

import type {
    PluginsState,
    PostDropdownMenuAction,
    RightHandSidebarComponent,
    AppBarChannelAction,
    AppBarAction,
} from 'types/store/plugins';

const defaultShouldRender = () => true;

function dispatchPluginComponentAction(name: keyof PluginsState['components'], pluginId: string, component: React.ComponentType<any>, id = generateId()) {
    store.dispatch({
        type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
        name,
        data: {
            id,
            pluginId,
            component,
        },
    });

    return id;
}

function dispatchPluginComponentWithData<T extends keyof PluginsState['components']>(name: T, data: PluginsState['components'][T][number]) {
    store.dispatch({
        type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
        name,
        data,
    });
}

type ReactResolvable = React.ReactNode | React.ElementType;
const resolveReactElement = (element: ReactResolvable) => {
    if (
        element &&
        !React.isValidElement(element) &&
        isValidElementType(element) &&
        typeof element !== 'string'
    ) {
        // Allow element to be passed as the name of the component, instead of a React element.
        return React.createElement(element);
    }

    return element;
};

const standardizeRoute = (route: string) => {
    let fixedRoute = route.trim();
    if (fixedRoute[0] === '/') {
        fixedRoute = fixedRoute.substring(1);
    }
    return fixedRoute;
};

export default class PluginRegistry implements PluginRegistryInterface, InternalPluginRegistry {
    id: string;
    constructor(id: string) {
        this.id = id;
    }

    supports = {
        globalAppBar: true,
        globalRhs: true,
    };

    registerRootComponent: PluginRegistryInterface['registerRootComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('Root', this.id, component);
    });

    registerPopoverUserAttributesComponent: PluginRegistryInterface['registerPopoverUserAttributesComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('PopoverUserAttributes', this.id, component);
    });

    registerPopoverUserActionsComponent: PluginRegistryInterface['registerPopoverUserActionsComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('PopoverUserActions', this.id, component);
    });

    registerLeftSidebarHeaderComponent: PluginRegistryInterface['registerLeftSidebarHeaderComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('LeftSidebarHeader', this.id, component);
    });

    registerBottomTeamSidebarComponent: PluginRegistryInterface['registerBottomTeamSidebarComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('BottomTeamSidebar', this.id, component);
    });

    registerPostMessageAttachmentComponent: PluginRegistryInterface['registerPostMessageAttachmentComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('PostMessageAttachment', this.id, component);
    });

    registerSearchComponents: PluginRegistryInterface['registerSearchComponents'] = ({
        buttonComponent,
        suggestionsComponent,
        hintsComponent,
        action,
    }) => {
        const id = generateId();
        dispatchPluginComponentWithData('SearchButtons', {
            id,
            pluginId: this.id,
            component: buttonComponent,
            action,
        });
        dispatchPluginComponentAction('SearchSuggestions', this.id, suggestionsComponent, id);
        dispatchPluginComponentAction('SearchHints', this.id, hintsComponent, id);
        return id;
    };

    registerLinkTooltipComponent: PluginRegistryInterface['registerLinkTooltipComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('LinkTooltip', this.id, component);
    });

    registerActionAfterChannelCreation: PluginRegistryInterface['registerActionAfterChannelCreation'] = reArg(['component', 'action'], ({
        component,
        action,
    }) => {
        const id = generateId();
        dispatchPluginComponentWithData('CreateBoardFromTemplate', {
            id,
            pluginId: this.id,
            component,
            action,
        });
        return id;
    });

    registerChannelHeaderButtonAction: PluginRegistryInterface['registerChannelHeaderButtonAction'] = reArg([
        'icon',
        'action',
        'dropdownText',
        'tooltipText',
    ], ({
        icon,
        action,
        dropdownText,
        tooltipText,
    }) => {
        const id = generateId();

        const data = {
            id,
            pluginId: this.id,
            icon: resolveReactElement(icon),
            action,
            dropdownText: resolveReactElement(dropdownText),
            tooltipText: resolveReactElement(tooltipText),
        };

        dispatchPluginComponentWithData('ChannelHeaderButton', data);
        dispatchPluginComponentWithData('MobileChannelHeaderButton', data);

        return id;
    });

    registerChannelIntroButtonAction: PluginRegistryInterface['registerChannelIntroButtonAction'] = reArg([
        'icon',
        'action',
        'text',
    ], ({
        icon,
        action,
        text,
    }) => {
        const id = generateId();

        const data = {
            id,
            pluginId: this.id,
            icon: resolveReactElement(icon),
            action,
            text,
        };

        dispatchPluginComponentWithData('ChannelIntroButton', data);

        return id;
    });

    registerCallButtonAction: PluginRegistryInterface['registerCallButtonAction'] = reArg([
        'button',
        'dropdownButton',
        'action',
    ], ({
        button,
        dropdownButton,
        action,
    }) => {
        const id = generateId();

        const data = {
            id,
            pluginId: this.id,
            button: resolveReactElement(button),
            dropdownButton: resolveReactElement(dropdownButton),
            icon: null, // Needed to satisfy types for MobileChannelHeaderButton
            action,
        };

        dispatchPluginComponentWithData('CallButton', data);
        dispatchPluginComponentWithData('MobileChannelHeaderButton', data);

        return id;
    });

    registerPostTypeComponent: PluginRegistryInterface['registerPostTypeComponent'] = reArg(['type', 'component'], ({
        type,
        component,
    }) => {
        const id = generateId();

        store.dispatch({
            type: ActionTypes.RECEIVED_PLUGIN_POST_COMPONENT,
            data: {
                id,
                pluginId: this.id,
                type,
                component,
            },
        });

        return id;
    });

    registerPostCardTypeComponent: PluginRegistryInterface['registerPostCardTypeComponent'] = reArg(['type', 'component'], ({
        type,
        component,
    }) => {
        const id = generateId();

        store.dispatch({
            type: ActionTypes.RECEIVED_PLUGIN_POST_CARD_COMPONENT,
            data: {
                id,
                pluginId: this.id,
                type,
                component,
            },
        });

        return id;
    });

    registerPostWillRenderEmbedComponent: PluginRegistryInterface['registerPostWillRenderEmbedComponent'] = reArg(['match', 'component', 'toggleable'], ({
        match,
        component,
        toggleable,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('PostWillRenderEmbedComponent', {
            id,
            pluginId: this.id,
            component,
            match,
            toggleable,
        });

        return id;
    });

    registerMainMenuAction: PluginRegistryInterface['registerMainMenuAction'] = reArg([
        'text',
        'action',
        'mobileIcon',
    ], ({
        text,
        action,
        mobileIcon,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('MainMenu', {
            id,
            pluginId: this.id,
            text: resolveReactElement(text),
            action,
            mobileIcon: resolveReactElement(mobileIcon),
        });

        return id;
    });

    registerChannelHeaderMenuAction: PluginRegistryInterface['registerChannelHeaderMenuAction'] = reArg([
        'text',
        'action',
        'shouldRender',
    ], ({
        text,
        action,
        shouldRender = defaultShouldRender,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('ChannelHeader', {
            id,
            pluginId: this.id,
            text: resolveReactElement(text),
            action,
            shouldRender,
        });

        return id;
    });

    registerFileDropdownMenuAction: PluginRegistryInterface['registerFileDropdownMenuAction'] = reArg([
        'match',
        'text',
        'action',
    ], ({
        match,
        text,
        action,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('FilesDropdown', {
            id,
            pluginId: this.id,
            match,
            text: resolveReactElement(text),
            action,
        });

        return id;
    });

    registerUserGuideDropdownMenuAction: PluginRegistryInterface['registerUserGuideDropdownMenuAction'] = reArg([
        'text',
        'action',
    ], ({
        text,
        action,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('UserGuideDropdown', {
            id,
            pluginId: this.id,
            text: resolveReactElement(text),
            action,
        });

        return id;
    });

    registerPostActionComponent: PluginRegistryInterface['registerPostActionComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('PostAction', this.id, component);
    });

    registerPostEditorActionComponent: PluginRegistryInterface['registerPostEditorActionComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('PostEditorAction', this.id, component);
    });

    registerCodeBlockActionComponent: PluginRegistryInterface['registerCodeBlockActionComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('CodeBlockAction', this.id, component);
    });

    registerNewMessagesSeparatorActionComponent: PluginRegistryInterface['registerNewMessagesSeparatorActionComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('NewMessagesSeparatorAction', this.id, component);
    });

    registerPostDropdownMenuAction: PluginRegistryInterface['registerPostDropdownMenuAction'] = reArg([
        'text',
        'action',
        'filter',
    ], ({
        text,
        action,
        filter,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('PostDropdownMenu', {
            id,
            pluginId: this.id,
            text: resolveReactElement(text),
            action,
            filter,
        });

        return id;
    });

    registerPostDropdownSubMenuAction: PluginRegistryInterface['registerPostDropdownSubMenuAction'] = reArg([
        'text',
        'action',
        'filter',
    ], ({
        text,
        action,
        filter,
    }) => {
        const id = generateId();

        const registerMenuItem = (
            pluginId: string,
            id: string,
            parentMenuId: string | undefined,
            innerText: ReactResolvable,
            innerAction: PostDropdownMenuAction['action'],
            innerFilter: PostDropdownMenuAction['filter'],
        ) => {
            dispatchPluginComponentWithData('PostDropdownMenu', {
                id,
                parentMenuId,
                pluginId,
                text: resolveReactElement(innerText),
                subMenu: [],
                action: innerAction,
                filter: innerFilter,
            });

            type TInnerParams = [
                innerText: ReactResolvable,
                innerAction: PostDropdownMenuAction['action'],
                innerFilter: PostDropdownMenuAction['filter'],
            ];

            return function registerSubMenuItem(...args: TInnerParams) {
                if (parentMenuId) {
                    throw new Error('Submenus are currently limited to a single level.');
                }

                return registerMenuItem(pluginId, generateId(), id, ...args);
            };
        };

        return {id, rootRegisterMenuItem: registerMenuItem(this.id, id, undefined, text, action, filter)};
    });

    registerPostDropdownMenuComponent: PluginRegistryInterface['registerPostDropdownMenuComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('PostDropdownMenuItem', this.id, component);
    });

    registerFileUploadMethod: PluginRegistryInterface['registerFileUploadMethod'] = reArg([
        'icon',
        'action',
        'text',
    ], ({
        icon,
        action,
        text,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('FileUploadMethod', {
            id,
            pluginId: this.id,
            text,
            action,
            icon,
        });

        return id;
    });

    registerFilesWillUploadHook: PluginRegistryInterface['registerFilesWillUploadHook'] = reArg(['hook'], ({hook}) => {
        const id = generateId();

        dispatchPluginComponentWithData('FilesWillUploadHook', {
            id,
            pluginId: this.id,
            hook,
        });

        return id;
    });

    unregisterComponent: PluginRegistryInterface['unregisterComponent'] = reArg(['componentId'], ({componentId}) => {
        store.dispatch({
            type: ActionTypes.REMOVED_PLUGIN_COMPONENT,
            id: componentId,
        });
    });

    unregisterPostTypeComponent: PluginRegistryInterface['unregisterPostTypeComponent'] = reArg(['componentId'], ({
        componentId,
    }) => {
        store.dispatch({
            type: ActionTypes.REMOVED_PLUGIN_POST_COMPONENT,
            id: componentId,
        });
    });

    registerReducer: PluginRegistryInterface['registerReducer'] = reArg(['reducer'], ({reducer}) => {
        reducerRegistry.register('plugins-' + this.id, reducer);
    });

    registerWebSocketEventHandler: PluginRegistryInterface['registerWebSocketEventHandler'] = reArg(['event', 'handler'], ({
        event,
        handler,
    }) => {
        registerPluginWebSocketEvent(this.id, event, handler);
    });

    unregisterWebSocketEventHandler: PluginRegistryInterface['unregisterWebSocketEventHandler'] = reArg(['event'], ({
        event,
    }) => {
        unregisterPluginWebSocketEvent(this.id, event);
    });

    registerReconnectHandler: PluginRegistryInterface['registerReconnectHandler'] = reArg(['handler'], ({
        handler,
    }) => {
        registerPluginReconnectHandler(this.id, handler);
    });

    unregisterReconnectHandler() {
        unregisterPluginReconnectHandler(this.id);
    }

    registerMessageWillBePostedHook: PluginRegistryInterface['registerMessageWillBePostedHook'] = reArg(['hook'], ({
        hook,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('MessageWillBePosted', {
            id,
            pluginId: this.id,
            hook,
        });

        return id;
    });

    registerSlashCommandWillBePostedHook: PluginRegistryInterface['registerSlashCommandWillBePostedHook'] = reArg(['hook'], ({
        hook,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('SlashCommandWillBePosted', {
            id,
            pluginId: this.id,
            hook,
        });

        return id;
    });

    registerMessageWillFormatHook: PluginRegistryInterface['registerMessageWillFormatHook'] = reArg(['hook'], ({hook}) => {
        const id = generateId();

        dispatchPluginComponentWithData('MessageWillFormat', {
            id,
            pluginId: this.id,
            hook,
        });

        return id;
    });

    registerFilePreviewComponent: PluginRegistryInterface['registerFilePreviewComponent'] = reArg(['override', 'component'], ({
        override,
        component,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('FilePreview', {
            id,
            pluginId: this.id,
            override,
            component,
        });

        return id;
    });

    registerTranslations: PluginRegistryInterface['registerTranslations'] = reArg(['getTranslationsForLocale'], ({
        getTranslationsForLocale,
    }) => {
        store.dispatch(registerPluginTranslationsSource(this.id, getTranslationsForLocale));
    });

    registerAdminConsolePlugin: PluginRegistryInterface['registerAdminConsolePlugin'] = reArg(['func'], ({func}) => {
        store.dispatch(registerAdminConsolePlugin(this.id, func));
    });

    unregisterAdminConsolePlugin() {
        store.dispatch(unregisterAdminConsolePlugin(this.id));
    }

    registerAdminConsoleCustomSetting: PluginRegistryInterface['registerAdminConsoleCustomSetting'] = reArg([
        'key',
        'component',
        'options',
    ], ({
        key,
        component,
        options: {showTitle} = {showTitle: false},
    }) => {
        store.dispatch(registerAdminConsoleCustomSetting(this.id, key, component, {showTitle}));
    });

    registerAdminConsoleCustomSection: PluginRegistryInterface['registerAdminConsoleCustomSection'] = reArg([
        'key',
        'component',
    ], ({
        key,
        component,
    }) => {
        store.dispatch(registerAdminConsoleCustomSection(this.id, key, component));
    });

    registerRightHandSidebarComponent: PluginRegistryInterface['registerRightHandSidebarComponent'] = reArg([
        'component',
        'title',
    ], ({
        component,
        title,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('RightHandSidebarComponent', {
            id,
            pluginId: this.id,
            component,
            title: resolveReactElement(title),
        });

        return {id, showRHSPlugin: showRHSPlugin(id), hideRHSPlugin: hideRHSPlugin(id), toggleRHSPlugin: toggleRHSPlugin(id)};
    });

    registerNeedsTeamRoute: PluginRegistryInterface['registerNeedsTeamRoute'] = reArg([
        'route',
        'component',
    ], ({
        route,
        component,
    }) => {
        const id = generateId();
        let fixedRoute = standardizeRoute(route);
        fixedRoute = this.id + '/' + fixedRoute;

        dispatchPluginComponentWithData('NeedsTeamComponent', {
            id,
            pluginId: this.id,
            component,
            route: fixedRoute,
        });

        return id;
    });

    registerCustomRoute: PluginRegistryInterface['registerCustomRoute'] = reArg([
        'route',
        'component',
    ], ({
        route,
        component,
    }) => {
        const id = generateId();
        let fixedRoute = standardizeRoute(route);
        fixedRoute = this.id + '/' + fixedRoute;

        dispatchPluginComponentWithData('CustomRouteComponent', {
            id,
            pluginId: this.id,
            component,
            route: fixedRoute,
        });

        return id;
    });

    registerProduct: InternalPluginRegistry['registerProduct'] = reArg([
        'baseURL',
        'switcherIcon',
        'switcherText',
        'switcherLinkURL',
        'mainComponent',
        'headerCentreComponent',
        'headerRightComponent',
        'showTeamSidebar',
        'showAppBar',
        'wrapped',
        'publicComponent',
    ], ({
        baseURL,
        switcherIcon,
        switcherText,
        switcherLinkURL,
        mainComponent,
        headerCentreComponent = () => null,
        headerRightComponent = () => null,
        showTeamSidebar = false,
        showAppBar = false,
        wrapped = true,
        publicComponent,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('Product', {
            id,
            pluginId: this.id,
            switcherIcon: switcherIcon as IconGlyphTypes,
            switcherText: resolveReactElement(switcherText),
            baseURL: '/' + standardizeRoute(baseURL),
            switcherLinkURL: '/' + standardizeRoute(switcherLinkURL),
            mainComponent,
            headerCentreComponent,
            headerRightComponent,
            showTeamSidebar,
            showAppBar,
            wrapped,
            publicComponent,
        });

        return id;
    });

    registerMessageWillBeUpdatedHook: PluginRegistryInterface['registerMessageWillBeUpdatedHook'] = reArg(['hook'], ({
        hook,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('MessageWillBeUpdated', {
            id,
            pluginId: this.id,
            hook,
        });

        return id;
    });

    registerSidebarChannelLinkLabelComponent: InternalPluginRegistry['registerSidebarChannelLinkLabelComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('SidebarChannelLinkLabel', this.id, component);
    });

    registerChannelToastComponent: InternalPluginRegistry['registerChannelToastComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('ChannelToast', this.id, component);
    });

    registerGlobalComponent: InternalPluginRegistry['registerGlobalComponent'] = reArg(['component'], ({
        component,
    }) => {
        return dispatchPluginComponentAction('Global', this.id, component);
    });

    registerAppBarComponent: InternalPluginRegistry['registerAppBarComponent'] = reArg([
        'iconUrl',
        'action',
        'tooltipText',
        'supportedProductIds',
        'rhsComponent',
        'rhsTitle',
    ], ({
        iconUrl,
        action,
        tooltipText,
        supportedProductIds = null,
        rhsComponent,
        rhsTitle,
    }: {
        iconUrl: AppBarAction['iconUrl'];
        tooltipText: ReactResolvable;
        supportedProductIds: AppBarAction['supportedProductIds'];
    } & ({
        action: AppBarChannelAction;
        rhsComponent?: never;
        rhsTitle?: never;
    } | {
        action?: never;
        rhsComponent: RightHandSidebarComponent['component'];
        rhsTitle: ReactResolvable;
    })) => {
        const id = generateId();

        const registeredRhsComponent = rhsComponent && this.registerRightHandSidebarComponent({title: rhsTitle, component: rhsComponent});

        dispatchPluginComponentWithData('AppBar', {
            id,
            pluginId: this.id,
            iconUrl,
            tooltipText: resolveReactElement(tooltipText),
            supportedProductIds,
            ...registeredRhsComponent ? {
                action: () => store.dispatch(registeredRhsComponent.toggleRHSPlugin),
                rhsComponentId: registeredRhsComponent.id,
            } : {
                action: action!,
            },
        });

        return registeredRhsComponent ? {id, rhsComponent: registeredRhsComponent} : id;
    }) as InternalPluginRegistry['registerAppBarComponent'];

    registerSiteStatisticsHandler: InternalPluginRegistry['registerSiteStatisticsHandler'] = reArg(['handler'], ({
        handler,
    }) => {
        const data = {
            pluginId: this.id,
            handler,
        };
        store.dispatch({
            type: ActionTypes.RECEIVED_PLUGIN_STATS_HANDLER,
            data,
        });
    });

    registerDesktopNotificationHook: PluginRegistryInterface['registerDesktopNotificationHook'] = reArg(['hook'], ({
        hook,
    }) => {
        const id = generateId();

        dispatchPluginComponentWithData('DesktopNotificationHooks', {
            id,
            pluginId: this.id,
            hook,
        });

        return id;
    });

    registerUserSettings: PluginRegistryInterface['registerUserSettings'] = reArg(['setting'], ({setting}) => {
        const data = {
            pluginId: this.id,
            setting,
        };
        store.dispatch({
            type: ActionTypes.RECEIVED_PLUGIN_USER_SETTINGS,
            data,
        });
    });
}
