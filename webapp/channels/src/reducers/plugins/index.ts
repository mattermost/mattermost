// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import remove from 'lodash/remove';
import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {ClientPluginManifest} from '@mattermost/types/plugins';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';
import {extractPluginConfiguration} from 'utils/plugins/plugin_setting_extraction';

import type {PluginsState, PluginComponent, AdminConsolePluginComponent, Menu} from 'types/store/plugins';

function hasMenuId(menu: Menu|PluginComponent, menuId: string) {
    if (!menu.subMenu) {
        return false;
    }

    if (menu.id === menuId) {
        return true;
    }
    for (const subMenu of menu.subMenu) {
        // Recursively check if subMenu contains menuId.
        if (hasMenuId(subMenu, menuId)) {
            return true;
        }
    }
    return false;
}

function buildMenu(rootMenu: Menu|PluginComponent, data: Menu): Menu|PluginComponent {
    // Recursively build the full menu tree.
    const subMenu = rootMenu.subMenu?.map((m: Menu) => buildMenu(m, data));
    if (rootMenu.id === data.parentMenuId) {
        subMenu?.push(data);
    }

    return {
        ...rootMenu,
        subMenu: subMenu as Menu[],
    };
}

function sortComponents(a: PluginComponent, b: PluginComponent) {
    if (a.pluginId < b.pluginId) {
        return -1;
    }

    if (a.pluginId > b.pluginId) {
        return 1;
    }

    return 0;
}

function removePostPluginComponents(state: PluginsState['postTypes'], action: AnyAction) {
    if (!action.data) {
        return state;
    }

    const nextState = {...state};
    let modified = false;
    Object.keys(nextState).forEach((k) => {
        const c = nextState[k];
        if (c.pluginId === action.data.id) {
            Reflect.deleteProperty(nextState, k);
            modified = true;
        }
    });

    if (modified) {
        return nextState;
    }

    return state;
}

function removePostPluginComponent(state: PluginsState['postTypes'], action: AnyAction) {
    const nextState = {...state};
    const keys = Object.keys(nextState);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (nextState[k].id === action.id) {
            Reflect.deleteProperty(nextState, k);
            return nextState;
        }
    }

    return state;
}

function removePluginComponents(state: PluginsState['components'], action: AnyAction) {
    if (!action.data) {
        return state;
    }

    const nextState = {...state};
    const types = Object.keys(nextState);
    let modified = false;
    for (let i = 0; i < types.length; i++) {
        const componentType = types[i];
        const componentList = nextState[componentType] || [];
        for (let j = componentList.length - 1; j >= 0; j--) {
            if (componentList[j].pluginId === action.data.id) {
                const nextArray = [...nextState[componentType]];
                nextArray.splice(j, 1);
                nextState[componentType] = nextArray;
                modified = true;
            }
        }
    }

    if (modified) {
        return nextState;
    }

    return state;
}

function removePluginComponent(state: PluginsState['components'], action: AnyAction) {
    let newState = state;
    const types = Object.keys(state);
    for (let i = 0; i < types.length; i++) {
        const componentType = types[i];
        const componentList = state[componentType] || [];
        for (let j = 0; j < componentList.length; j++) {
            if (componentList[j].id === action.id) {
                const nextArray = [...componentList];
                nextArray.splice(j, 1);
                newState = {...newState, [componentType]: nextArray};
            }
        }
    }
    return newState;
}

function plugins(state: IDMappedObjects<ClientPluginManifest> = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_WEBAPP_PLUGINS: {
        if (action.data) {
            const nextState: IDMappedObjects<ClientPluginManifest> = {};
            action.data.forEach((p: ClientPluginManifest) => {
                nextState[p.id] = p;
            });
            return nextState;
        }
        return state;
    }
    case ActionTypes.RECEIVED_WEBAPP_PLUGIN: {
        if (action.data) {
            const nextState = {...state};
            nextState[action.data.id] = action.data;
            return nextState;
        }
        return state;
    }
    case ActionTypes.REMOVED_WEBAPP_PLUGIN: {
        if (action.data && state[action.data.id]) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, action.data.id);
            return nextState;
        }
        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

const initialComponents: PluginsState['components'] = {
    AppBar: [],
    CallButton: [],
    FilePreview: [],
    LinkTooltip: [],
    MainMenu: [],
    ChannelHeaderButton: [],
    MobileChannelHeaderButton: [],
    PostDropdownMenu: [],
    PostAction: [],
    PostEditorAction: [],
    CodeBlockAction: [],
    NewMessagesSeparatorAction: [],
    Product: [],
    RightHandSidebarComponent: [],
    UserGuideDropdownItem: [],
    FilesWillUploadHook: [],
    NeedsTeamComponent: [],
    CreateBoardFromTemplate: [],
    DesktopNotificationHooks: [],
};

function components(state: PluginsState['components'] = initialComponents, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_PLUGIN_COMPONENT: {
        if (action.name && action.data) {
            const nextState = {...state};
            const currentArray = nextState[action.name] || [];
            const nextArray = [...currentArray];
            let actionData = action.data;
            if (action.name === 'PostDropdownMenu' && actionData.parentMenuId) {
                // Remove the menu from nextArray to rebuild it later.
                const menu = remove(nextArray, (c) => hasMenuId(c, actionData.parentMenuId) && c.pluginId === actionData.pluginId);

                // Request is for an unknown menuId, return original state.
                if (!menu[0]) {
                    return state;
                }
                actionData = buildMenu(menu[0], actionData);
            }
            nextArray.push(actionData);
            nextArray.sort(sortComponents);
            nextState[action.name] = nextArray;
            return nextState;
        }
        return state;
    }
    case ActionTypes.REMOVED_PLUGIN_COMPONENT:
        return removePluginComponent(state, action);
    case ActionTypes.REMOVED_WEBAPP_PLUGIN:
        return removePluginComponents(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return initialComponents;
    default:
        return state;
    }
}

function postTypes(state: PluginsState['postTypes'] = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_PLUGIN_POST_COMPONENT: {
        if (action.data) {
            // Skip saving the component if one already exists and the new plugin id
            // is lower alphabetically
            const currentPost = state[action.data.type];
            if (currentPost && action.data.pluginId > currentPost.pluginId) {
                return state;
            }

            const nextState = {...state};
            nextState[action.data.type] = action.data;
            return nextState;
        }
        return state;
    }
    case ActionTypes.REMOVED_PLUGIN_POST_COMPONENT:
        return removePostPluginComponent(state, action);
    case ActionTypes.REMOVED_WEBAPP_PLUGIN:
        return removePostPluginComponents(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function postCardTypes(state: PluginsState['postTypes'] = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_PLUGIN_POST_CARD_COMPONENT: {
        if (action.data) {
            // Skip saving the component if one already exists and the new plugin id
            // is lower alphabetically
            const currentPost = state[action.data.type];
            if (currentPost && action.data.pluginId > currentPost.pluginId) {
                return state;
            }

            const nextState = {...state};
            nextState[action.data.type] = action.data;
            return nextState;
        }
        return state;
    }
    case ActionTypes.REMOVED_PLUGIN_POST_CARD_COMPONENT:
        return removePostPluginComponent(state, action);
    case ActionTypes.REMOVED_WEBAPP_PLUGIN:
        return removePostPluginComponents(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function adminConsoleReducers(state: {[pluginId: string]: any} = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_ADMIN_CONSOLE_REDUCER: {
        if (action.data) {
            const nextState = {...state};
            nextState[action.data.pluginId] = action.data.reducer;
            return nextState;
        }
        return state;
    }
    case ActionTypes.REMOVED_ADMIN_CONSOLE_REDUCER: {
        if (action.data && state[action.data.pluginId]) {
            const nextState = {...state};
            delete nextState[action.data.pluginId];
            return nextState;
        }
        return state;
    }
    case ActionTypes.REMOVED_WEBAPP_PLUGIN:
        if (action.data && state[action.data.id]) {
            const nextState = {...state};
            delete nextState[action.data.id];
            return nextState;
        }
        return state;

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function adminConsoleCustomComponents(state: {[pluginId: string]: Record<string, AdminConsolePluginComponent>} = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_ADMIN_CONSOLE_CUSTOM_COMPONENT: {
        if (!action.data) {
            return state;
        }

        const pluginId = action.data.pluginId;
        const key = action.data.key.toLowerCase();

        const nextState = {...state};
        let nextArray: Record<string, AdminConsolePluginComponent> = {};
        if (nextState[pluginId]) {
            nextArray = {...nextState[pluginId]};
        }
        nextArray[key] = action.data;
        nextState[pluginId] = nextArray;

        return nextState;
    }
    case ActionTypes.REMOVED_WEBAPP_PLUGIN: {
        if (!action.data || !state[action.data.id]) {
            return state;
        }

        const pluginId = action.data.id;
        const nextState = {...state};
        delete nextState[pluginId];
        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function siteStatsHandlers(state: PluginsState['siteStatsHandlers'] = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_PLUGIN_STATS_HANDLER:
        if (action.data) {
            const nextState = {...state};
            nextState[action.data.pluginId] = action.data.handler;
            return nextState;
        }
        return state;

    case ActionTypes.REMOVED_WEBAPP_PLUGIN:
        if (action.data) {
            const nextState = {...state};
            delete nextState[action.data.id];
            return nextState;
        }
        return state;

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function userSettings(state: PluginsState['userSettings'] = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_PLUGIN_USER_SETTINGS:
        if (action.data) {
            const extractedConfiguration = extractPluginConfiguration(action.data.setting, action.data.pluginId);
            if (!extractedConfiguration) {
                // eslint-disable-next-line no-console
                console.warn(`Plugin ${action.data.pluginId} is trying to register an invalid configuration. Contact the plugin developer to fix this issue.`);
                return state;
            }
            const nextState = {...state};
            nextState[action.data.pluginId] = extractedConfiguration;
            return nextState;
        }
        return state;
    case ActionTypes.REMOVED_WEBAPP_PLUGIN:
        if (action.data) {
            const nextState = {...state};
            delete nextState[action.data.id];
            return nextState;
        }
        return state;

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({

    // object where every key is a plugin id and values are webapp plugin manifests
    plugins,

    // object where every key is a component name and the values are arrays of
    // components wrapped in an object that contains an id and plugin id
    components,

    // object where every key is a post type and the values are components wrapped in an
    // an object that contains a plugin id
    postTypes,

    // object where every key is a post type and the values are components wrapped in an
    // an object that contains a plugin id
    postCardTypes,

    // object where every key is a plugin id and the value is a function that
    // modifies the admin console definition data structure
    adminConsoleReducers,

    // objects where every key is a plugin id and the value is an object mapping keys to a custom
    // React component to render on the plugin's system console.
    adminConsoleCustomComponents,

    // objects where every key is a plugin id and the value is a promise to fetch stats from
    // a plugin to render on system console
    siteStatsHandlers,

    // objects where every key is a plugin id and the value is configuration schema to show in
    // the user settings modal
    userSettings,
});
