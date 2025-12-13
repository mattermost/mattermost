// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';
import {fileURLToPath} from 'url';

import type {LighthouseMetric} from './types';

/**
 * Directory paths
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RESULTS_DIR = path.resolve(__dirname, '../results');
export const STORAGE_STATE_DIR = path.resolve(__dirname, '../storage_state');
export const BASELINE_DIR = path.resolve(__dirname, '../baseline');
export const LATEST_BASELINE_FILE = path.resolve(BASELINE_DIR, 'latest_perf.json');

/**
 * Google's Web Vitals thresholds (in milliseconds for timing metrics)
 * Reference: https://web.dev/articles/vitals
 */
export const WEB_VITALS_THRESHOLDS = {
    lcp: {good: 2500, needsImprovement: 4000},
    fcp: {good: 1800, needsImprovement: 3000},
    tbt: {good: 200, needsImprovement: 600},
    cls: {good: 0.1, needsImprovement: 0.25},
    si: {good: 3400, needsImprovement: 5800},
    tti: {good: 3800, needsImprovement: 7300},
};

/**
 * Metric definitions with categorization
 */
export const METRIC_DEFINITIONS: Record<
    string,
    {name: string; category: 'coreWebVitals' | 'timing' | 'resources' | 'diagnostics'; unit: LighthouseMetric['unit']}
> = {
    // Core Web Vitals
    'largest-contentful-paint': {name: 'Largest Contentful Paint (LCP)', category: 'coreWebVitals', unit: 'ms'},
    'cumulative-layout-shift': {name: 'Cumulative Layout Shift (CLS)', category: 'coreWebVitals', unit: 'ratio'},
    'total-blocking-time': {name: 'Total Blocking Time (TBT)', category: 'coreWebVitals', unit: 'ms'},

    // Timing metrics
    'first-contentful-paint': {name: 'First Contentful Paint (FCP)', category: 'timing', unit: 'ms'},
    'first-meaningful-paint': {name: 'First Meaningful Paint (FMP)', category: 'timing', unit: 'ms'},
    'speed-index': {name: 'Speed Index (SI)', category: 'timing', unit: 'ms'},
    interactive: {name: 'Time to Interactive (TTI)', category: 'timing', unit: 'ms'},
    'server-response-time': {name: 'Server Response Time (TTFB)', category: 'timing', unit: 'ms'},
    'max-potential-fid': {name: 'Max Potential FID', category: 'timing', unit: 'ms'},

    // Resource metrics
    'total-byte-weight': {name: 'Total Byte Weight', category: 'resources', unit: 'bytes'},
    'render-blocking-resources': {name: 'Render Blocking Resources', category: 'resources', unit: 'ms'},
    'uses-long-cache-ttl': {name: 'Cache TTL', category: 'resources', unit: 'bytes'},
    'unminified-javascript': {name: 'Unminified JavaScript', category: 'resources', unit: 'bytes'},
    'unminified-css': {name: 'Unminified CSS', category: 'resources', unit: 'bytes'},
    'unused-javascript': {name: 'Unused JavaScript', category: 'resources', unit: 'bytes'},
    'unused-css-rules': {name: 'Unused CSS', category: 'resources', unit: 'bytes'},
    'modern-image-formats': {name: 'Modern Image Formats', category: 'resources', unit: 'bytes'},
    'uses-optimized-images': {name: 'Optimized Images', category: 'resources', unit: 'bytes'},
    'uses-responsive-images': {name: 'Responsive Images', category: 'resources', unit: 'bytes'},
    'uses-text-compression': {name: 'Text Compression', category: 'resources', unit: 'bytes'},
    'efficient-animated-content': {name: 'Efficient Animated Content', category: 'resources', unit: 'bytes'},
    'duplicated-javascript': {name: 'Duplicated JavaScript', category: 'resources', unit: 'bytes'},
    'legacy-javascript': {name: 'Legacy JavaScript', category: 'resources', unit: 'bytes'},

    // Diagnostic metrics
    'dom-size': {name: 'DOM Size', category: 'diagnostics', unit: 'count'},
    'bootup-time': {name: 'JavaScript Boot-up Time', category: 'diagnostics', unit: 'ms'},
    'mainthread-work-breakdown': {name: 'Main Thread Work', category: 'diagnostics', unit: 'ms'},
    'critical-request-chains': {name: 'Critical Request Chains', category: 'diagnostics', unit: 'unitless'},
    'network-rtt': {name: 'Network RTT', category: 'diagnostics', unit: 'ms'},
    'network-server-latency': {name: 'Network Server Latency', category: 'diagnostics', unit: 'ms'},
    'long-tasks': {name: 'Long Tasks', category: 'diagnostics', unit: 'ms'},
    'third-party-summary': {name: 'Third Party Summary', category: 'diagnostics', unit: 'ms'},
    'third-party-facades': {name: 'Third Party Facades', category: 'diagnostics', unit: 'ms'},
    'layout-shifts': {name: 'Layout Shifts', category: 'diagnostics', unit: 'ratio'},
    'non-composited-animations': {name: 'Non-composited Animations', category: 'diagnostics', unit: 'unitless'},
    'unsized-images': {name: 'Unsized Images', category: 'diagnostics', unit: 'unitless'},
    viewport: {name: 'Viewport', category: 'diagnostics', unit: 'unitless'},
    'user-timings': {name: 'User Timings', category: 'diagnostics', unit: 'ms'},
};

/**
 * Lighthouse configuration for desktop testing
 */
export const LIGHTHOUSE_FLAGS = {
    logLevel: 'info' as const,
    output: ['json', 'html'] as ('json' | 'html' | 'csv')[],
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    formFactor: 'desktop' as const,
    screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
    },
    throttlingMethod: 'provided' as const,
    throttling: {
        rttMs: 0,
        throughputKbps: 0,
        cpuSlowdownMultiplier: 1,
    },
    maxWaitForFcp: 15000,
    maxWaitForLoad: 15000,
    pauseAfterFcpMs: 1000,
    pauseAfterLoadMs: 1000,
    networkQuietThresholdMs: 1000,
    cpuQuietThresholdMs: 1000,
};
