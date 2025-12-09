// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Vite entry point for the Mattermost Channels web application.
 * This file bootstraps the application for Vite's development server.
 */

// Set up public path for dynamic asset loading
// In Vite, we use import.meta.env instead of process.env
const publicPath = import.meta.env.VITE_PUBLIC_PATH || import.meta.env.BASE_URL || '/static/';

declare global {
    interface Window {
        publicPath: string;
        basename: string;
    }
}

window.publicPath = publicPath;
window.basename = window.publicPath.substring(0, window.publicPath.length - '/static/'.length) || '';

// Import the actual application entry point (static import for proper bundling)
import './entry';
