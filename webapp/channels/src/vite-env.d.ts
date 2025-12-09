// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="vite/client" />

// Extend Vite's ImportMetaEnv with app-specific environment variables
interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_WS_URL: string;
    readonly VITE_PUBLIC_PATH: string;
    readonly VITE_SOURCEMAP: string;
    readonly VITE_BUNDLE_ANALYZER: string;
    readonly VITE_PORT: string;
    readonly VITE_HMR_PORT: string;
    readonly VITE_PERF_MONITORING: string;
}

// Extend Window interface with app-specific properties
declare global {
    interface Window {
        publicPath: string;
        basename: string;
    }
}

// Required for this file to be treated as a module
export {};
