// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, Page, ViewportSize} from '@playwright/test';

export type TestArgs = {
    page: Page;
    browserName: string;
    viewport?: ViewportSize | null;
};

export type TestConfig = {
    // Server
    baseURL: string;
    adminUsername: string;
    adminPassword: string;
    adminEmail: string;
    ensurePluginsInstalled: string[];
    resetBeforeTest: boolean;
    haClusterEnabled: boolean;
    haClusterNodeCount: number;
    haClusterName: string;
    pushNotificationServer: string;
    // CI
    isCI: boolean;
    // Playwright
    headless: boolean;
    slowMo: number;
    workers: number;
    // Visual tests
    snapshotEnabled: boolean;
    percyEnabled: boolean;
    percyToken?: string;
};

// Based on https://github.com/microsoft/playwright/blob/d6ec1ae3994f127e38b866a231a34efc6a4cac0d/packages/playwright/types/test.d.ts#L5692-L5759
export type ScreenshotOptions = {
    /**
     * When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different
     * treatment depending on their duration:
     * - finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
     * - infinite animations are canceled to initial state, and then played over after the screenshot.
     *
     * Defaults to `"disabled"` that disables animations.
     */
    animations?: 'disabled' | 'allow';

    /**
     * When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be
     * changed.  Defaults to `"hide"`.
     */
    caret?: 'hide' | 'initial';

    /**
     * An object which specifies clipping of the resulting image.
     */
    clip?: {
        /**
         * x-coordinate of top-left corner of clip area
         */
        x: number;

        /**
         * y-coordinate of top-left corner of clip area
         */
        y: number;

        /**
         * width of clipping area
         */
        width: number;

        /**
         * height of clipping area
         */
        height: number;
    };

    /**
     * When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to
     * `false`.
     */
    fullPage?: boolean;

    /**
     * Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink
     * box `#FF00FF` (customized by `maskColor`) that completely covers its bounding box.
     */
    mask?: Array<Locator>;

    /**
     * Specify the color of the overlay box for masked elements, in
     * [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
     */
    maskColor?: string;

    /**
     * An acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1`. Default is
     * configurable with `TestConfig.expect`. Unset by default.
     */
    maxDiffPixelRatio?: number;

    /**
     * An acceptable amount of pixels that could be different. Default is configurable with `TestConfig.expect`. Unset by
     * default.
     */
    maxDiffPixels?: number;

    /**
     * Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
     * Defaults to `false`.
     */
    omitBackground?: boolean;

    /**
     * When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this
     * will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so
     * screenshots of high-dpi devices will be twice as large or even larger.
     *
     * Defaults to `"css"`.
     */
    scale?: 'css' | 'device';

    /**
     * An acceptable perceived color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between the
     * same pixel in compared images, between zero (strict) and one (lax), default is configurable with
     * `TestConfig.expect`. Defaults to `0.2`.
     */
    threshold?: number;

    /**
     * Time to retry the assertion for in milliseconds. Defaults to `timeout` in `TestConfig.expect`.
     */
    timeout?: number;
};
