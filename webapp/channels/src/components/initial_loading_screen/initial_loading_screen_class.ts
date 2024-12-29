// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Measure, measureAndReport} from 'utils/performance_telemetry';
import {isDesktopApp} from 'utils/user_agent';

const ANIMATION_CLASS_FOR_MATTERMOST_LOGO_HIDE = 'LoadingAnimation__compass-shrink';
const ANIMATION_CLASS_FOR_COMPLETE_LOADER_HIDE = 'LoadingAnimation__shrink';

const LOADING_CLASS_FOR_SCREEN = 'LoadingScreen LoadingScreen--darkMode';
const LOADING_COMPLETE_CLASS_FOR_SCREEN = 'LoadingScreen LoadingScreen--darkMode LoadingScreen--loaded';

const STATIC_CLASS_FOR_ANIMATION = 'LoadingAnimation LoadingAnimation--darkMode';
const LOADING_CLASS_FOR_ANIMATION = STATIC_CLASS_FOR_ANIMATION + ' LoadingAnimation--spinning LoadingAnimation--loading';
const LOADING_COMPLETE_CLASS_FOR_ANIMATION = STATIC_CLASS_FOR_ANIMATION + ' LoadingAnimation--spinning LoadingAnimation--loaded';

const DESTROY_DELAY_AFTER_ANIMATION_END = 1000;

export class InitialLoadingScreenClass {
    private isLoading: boolean | null = true;

    private loadingScreenElement: HTMLElement | null;
    private loadingAnimationElement: HTMLElement | null;

    private initialLoadingScreenCSS: HTMLLinkElement | null;

    constructor() {
        this.loadingScreenElement = document.getElementById('initialPageLoadingScreen');
        this.loadingAnimationElement = document.getElementById('initialPageLoadingAnimation');
        this.initialLoadingScreenCSS = document.getElementById('initialLoadingScreenCSS') as HTMLLinkElement | null;

        this.handleAnimationEndEvent = this.handleAnimationEndEvent.bind(this);

        this.init();
    }

    private init() {
        if (isDesktopApp()) {
            // Let Mattermost desktop handle the loading screen
            this.destroy();
            return;
        }

        this.addAnimationEndListener();

        // Starting automatically in the constructor instead of waiting for call from the code base
        // as per the latest UX recommendation
        this.start();
    }

    private handleAnimationEndEvent(event: AnimationEvent) {
        if (!this.loadingAnimationElement) {
            return;
        }

        if (event.animationName === ANIMATION_CLASS_FOR_MATTERMOST_LOGO_HIDE || event.animationName === ANIMATION_CLASS_FOR_COMPLETE_LOADER_HIDE) {
            if (!this.isLoading) {
                this.loadingAnimationElement.className = STATIC_CLASS_FOR_ANIMATION;

                // Automatically destroy the loading screen after the animation has finished.
                // Should be changed if we want to loading animation to start again.
                setTimeout(() => {
                    this.destroy();
                }, DESTROY_DELAY_AFTER_ANIMATION_END);
            }
        }
    }

    private addAnimationEndListener() {
        if (this.loadingAnimationElement) {
            this.loadingAnimationElement.addEventListener('animationend', this.handleAnimationEndEvent);
        }
    }

    private removeAnimationEndListener() {
        if (this.loadingAnimationElement) {
            this.loadingAnimationElement.removeEventListener('animationend', this.handleAnimationEndEvent);
        }
    }

    private destroy() {
        this.removeAnimationEndListener();

        if (this.loadingScreenElement) {
            this.loadingScreenElement.remove();
            this.loadingScreenElement = null;
        }

        if (this.initialLoadingScreenCSS) {
            this.initialLoadingScreenCSS.remove();
            this.initialLoadingScreenCSS = null;
        }

        if (this.loadingAnimationElement) {
            this.loadingAnimationElement = null;
        }

        this.isLoading = null;
    }

    /**
     * The loading animations are always started as soon as the loading indicator is shown in the screen for the first time.
     * But we still want to have this start method in case we need to start the loading animations manually any time.
     * If we do want to do that then we should remove the set timeout destroy call doing above.
     */
    public start() {
        if (!this.loadingScreenElement || !this.loadingAnimationElement) {
            // eslint-disable-next-line no-console
            console.error('InitialLoadingScreen: No loading screen or animation element found');
            return;
        }

        this.isLoading = true;

        this.loadingScreenElement.className = LOADING_CLASS_FOR_SCREEN;
        this.loadingAnimationElement.className = LOADING_CLASS_FOR_ANIMATION;
    }

    public stop(pageType: string) {
        if (!this.loadingScreenElement || !this.loadingAnimationElement) {
            return;
        }

        this.isLoading = false;

        this.loadingScreenElement.className = LOADING_COMPLETE_CLASS_FOR_SCREEN;
        this.loadingAnimationElement.className = LOADING_COMPLETE_CLASS_FOR_ANIMATION;

        measureAndReport({
            name: Measure.SplashScreen,
            startMark: 0,
            canFail: false,
            labels: {
                page_type: pageType,
            },
        });
    }
}

