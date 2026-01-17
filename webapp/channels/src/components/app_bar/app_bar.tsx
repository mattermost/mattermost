// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import partition from 'lodash/partition';
import React, {useState, useEffect, useRef, useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {Permissions} from 'mattermost-redux/constants';
import {getAppBarAppBindings} from 'mattermost-redux/selectors/entities/apps';
import {isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {restoreRhsPanel, setActivePanelId, minimizeRhsPanel, closeRhsPanel, openRhsPanel} from 'actions/views/rhs';
import {getAppBarPluginComponents, getChannelHeaderPluginComponents, shouldShowAppBar} from 'selectors/plugins';
import {getOpenPanels, getActivePanelId, getPanelOrder} from 'selectors/rhs';
import LocalStorageStore from 'stores/local_storage_store';

import {suitePluginIds} from 'utils/constants';
import {useCurrentProduct, useCurrentProductId, inScope} from 'utils/products';

import type {RhsPanelState} from 'types/store/rhs_panel';

// Minimal panel data for persistence (excludes transient/derived state)
type PersistedPanelData = {
    id: string;
    type: RhsPanelState['type'];
    selectedPostId: string;
    selectedChannelId: string;
    title: string;
    minimized: boolean;
    createdAt: number;
};

type PersistedPanelsState = {
    panels: PersistedPanelData[];
    activePanelId: string | null;
};

// localStorage key for RHS panels (scoped by user)
const getRhsPanelsStorageKey = (userId: string) => `rhs_open_panels:${userId}`;

import AppBarBinding, {isAppBinding} from './app_bar_binding';
import AppBarMarketplace from './app_bar_marketplace';
import AppBarPluginComponent, {isAppBarComponent} from './app_bar_plugin_component';
import AppBarRhsPanel from './app_bar_rhs_panel';

import './app_bar.scss';

export default function AppBar() {
    const dispatch = useDispatch();
    const channelHeaderComponents = useSelector(getChannelHeaderPluginComponents);
    const appBarPluginComponents = useSelector(getAppBarPluginComponents);
    const appBarBindings = useSelector(getAppBarAppBindings);
    const currentProduct = useCurrentProduct();
    const currentProductId = useCurrentProductId();
    const enabled = useSelector(shouldShowAppBar);
    const canOpenMarketplace = useSelector((state: GlobalState) => (
        isMarketplaceEnabled(state) &&
        haveICurrentTeamPermission(state, Permissions.SYSCONSOLE_WRITE_PLUGINS)
    ));

    // RHS panel state
    const openPanels = useSelector(getOpenPanels);
    const activePanelId = useSelector(getActivePanelId);
    const panelOrder = useSelector(getPanelOrder);

    // Get current user for storage key scoping
    const currentUserId = useSelector(getCurrentUserId);

    // Track whether we've done the initial restore from storage
    const hasRestoredRef = useRef(false);

    // Save panels to localStorage
    const savePanelsToStorage = useCallback((panels: Record<string, RhsPanelState>, order: string[], activeId: string | null) => {
        if (!currentUserId) {
            return;
        }

        const panelsToStore: PersistedPanelData[] = order.map((panelId) => {
            const panel = panels[panelId];
            if (!panel) {
                return null;
            }
            return {
                id: panel.id,
                type: panel.type,
                selectedPostId: panel.selectedPostId,
                selectedChannelId: panel.selectedChannelId,
                title: panel.title,
                minimized: panel.minimized,
                createdAt: panel.createdAt,
            };
        }).filter((p): p is PersistedPanelData => p !== null);

        const dataToStore: PersistedPanelsState = {
            panels: panelsToStore,
            activePanelId: activeId,
        };

        LocalStorageStore.setItem(getRhsPanelsStorageKey(currentUserId), JSON.stringify(dataToStore));
    }, [currentUserId]);

    // Restore panels from localStorage on mount (once, synchronously)
    useEffect(() => {
        if (!currentUserId || hasRestoredRef.current) {
            return;
        }

        hasRestoredRef.current = true;

        // Only restore if Redux has no panels (fresh page load)
        if (panelOrder.length > 0) {
            return;
        }

        // Read from localStorage synchronously
        const storedData = LocalStorageStore.getItem(getRhsPanelsStorageKey(currentUserId));
        if (!storedData) {
            return;
        }

        try {
            const parsed: PersistedPanelsState = JSON.parse(storedData);
            if (parsed.panels && parsed.panels.length > 0) {
                // Restore each panel as minimized
                parsed.panels.forEach((panel) => {
                    dispatch(openRhsPanel({
                        id: panel.id,
                        type: panel.type,
                        selectedPostId: panel.selectedPostId,
                        selectedChannelId: panel.selectedChannelId,
                        title: panel.title,
                        minimized: true,
                        createdAt: panel.createdAt,
                    }));
                });
            }
        } catch (e) {
            // Invalid JSON in storage, ignore
        }
    }, [currentUserId, panelOrder.length, dispatch]);

    // Sync panel state changes to localStorage
    useEffect(() => {
        // Don't save until we've done initial restore
        if (!hasRestoredRef.current || !currentUserId) {
            return;
        }

        savePanelsToStorage(openPanels, panelOrder, activePanelId);
    }, [openPanels, activePanelId, panelOrder, currentUserId, savePanelsToStorage]);

    // Track Alt key state for showing close buttons on panel icons
    const [altPressed, setAltPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setAltPressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setAltPressed(false);
            }
        };
        // Also reset when window loses focus (Alt might be released while tabbed away)
        const handleBlur = () => {
            setAltPressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    if (
        !enabled ||
        (currentProduct && !currentProduct.showAppBar)
    ) {
        return null;
    }

    const coreProductsPluginIds = [suitePluginIds.focalboard, suitePluginIds.playbooks];

    const [coreProductComponents, pluginComponents] = partition(appBarPluginComponents, ({pluginId}) => {
        return coreProductsPluginIds.includes(pluginId);
    });

    // Create RHS panel components
    const rhsPanelComponents = panelOrder.map((panelId) => {
        const panel = openPanels[panelId];
        if (!panel) {
            return null;
        }

        return (
            <AppBarRhsPanel
                key={`rhs-panel-${panelId}`}
                panel={panel}
                isActive={activePanelId === panelId}
                showCloseButton={altPressed}
                onRestore={(id) => dispatch(restoreRhsPanel(id))}
                onMinimize={(id) => dispatch(minimizeRhsPanel(id))}
                onActivate={(id) => dispatch(setActivePanelId(id))}
                onClose={(id) => dispatch(closeRhsPanel(id))}
            />
        );
    }).filter(Boolean);

    const items = [
        ...coreProductComponents,
        getDivider(coreProductComponents.length, (rhsPanelComponents.length + pluginComponents.length + channelHeaderComponents.length + appBarBindings.length)),
        ...rhsPanelComponents,
        getDivider(rhsPanelComponents.length, (pluginComponents.length + channelHeaderComponents.length + appBarBindings.length)),
        ...pluginComponents,
        ...channelHeaderComponents,
        ...appBarBindings,
    ].map((x) => {
        if (!x) {
            return x;
        }

        if (isAppBarComponent(x)) {
            const supportedProductIds = 'supportedProductIds' in x ? x.supportedProductIds : undefined;
            if (!inScope(supportedProductIds ?? null, currentProductId, currentProduct?.pluginId)) {
                return null;
            }
            return (
                <AppBarPluginComponent
                    key={x.id}
                    component={x}
                />
            );
        } else if (isAppBinding(x)) {
            if (!inScope(x.supported_product_ids ?? null, currentProductId, currentProduct?.pluginId)) {
                return null;
            }
            return (
                <AppBarBinding
                    key={`${x.app_id}_${x.label}`}
                    binding={x}
                />
            );
        }
        return x;
    });

    return (
        <div className={'app-bar'}>
            <div className={'app-bar__top'}>
                {items}
            </div>
            {canOpenMarketplace && (
                <div className='app-bar__bottom'>
                    <AppBarMarketplace/>
                </div>
            )}
        </div>
    );
}

const getDivider = (beforeCount: number, afterCount: number) => (beforeCount && afterCount ? (
    <hr
        key='divider'
        className='app-bar__divider'
    />
) : null);
