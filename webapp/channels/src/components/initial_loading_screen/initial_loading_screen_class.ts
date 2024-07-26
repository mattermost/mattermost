// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const ANIMATION_CLASS_FOR_MATTERMOST_LOGO_HIDE = 'LoadingAnimation__compass-shrink';
const ANIMATION_CLASS_FOR_COMPLETE_LOADER_HIDE = 'LoadingAnimation__shrink';

const LOADING_CLASS_FOR_SCREEN = 'LoadingScreen LoadingScreen--darkMode';
const LOADING_COMPLETE_CLASS_FOR_SCREEN = 'LoadingScreen LoadingScreen--darkMode LoadingScreen--loaded';

const STATIC_CLASS_FOR_ANIMATION = 'LoadingAnimation LoadingAnimation--darkMode';
const LOADING_CLASS_FOR_ANIMATION = STATIC_CLASS_FOR_ANIMATION + ' LoadingAnimation--spinning LoadingAnimation--loading';
const LOADING_COMPLETE_CLASS_FOR_ANIMATION = STATIC_CLASS_FOR_ANIMATION + ' LoadingAnimation--spinning LoadingAnimation--loaded';

export class InitialLoadingScreenClass {
    private isLoading = true;

    private loadingScreenElement?: HTMLElement | null;
    private loadingAnimationElement?: HTMLElement | null;

    constructor() {
        this.loadingScreenElement = document.getElementById('initialPageLoadingScreen');
        this.loadingAnimationElement = document.getElementById('initialPageLoadingAnimation');

        this.handleAnimationEndEvent = this.handleAnimationEndEvent.bind(this);
    }

    private isMattermostDesktop() {
        return typeof window !== 'undefined' && 'desktop' in window;
    }

    private handleAnimationEndEvent(event: AnimationEvent) {
        if (!this.loadingAnimationElement) {
            return;
        }

        if (
            event.animationName === ANIMATION_CLASS_FOR_MATTERMOST_LOGO_HIDE ||
            event.animationName === ANIMATION_CLASS_FOR_COMPLETE_LOADER_HIDE
        ) {
            if (this.isLoading === false) {
                this.loadingAnimationElement.className = STATIC_CLASS_FOR_ANIMATION;

                setTimeout(() => {
                    this.clean();
                }, 1000);
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

    private clean() {
        this.removeAnimationEndListener();
    }

    public start() {
        if (this.isMattermostDesktop()) {
            // TODO We dont have the window yet
            // Let Mattermost desktop handle the loading screen
            return;
        }

        if (!this.loadingScreenElement || !this.loadingAnimationElement) {
            // eslint-disable-next-line no-console
            console.error('InitialLoadingScreen: No loading screen or animation element found');
            return;
        }

        this.addAnimationEndListener();

        this.isLoading = true;

        this.loadingScreenElement.className = LOADING_CLASS_FOR_SCREEN;
        this.loadingAnimationElement.className = LOADING_CLASS_FOR_ANIMATION;
    }

    public stop() {
        if (!this.loadingScreenElement || !this.loadingAnimationElement) {
            return;
        }

        this.isLoading = false;

        this.loadingScreenElement.className = LOADING_COMPLETE_CLASS_FOR_SCREEN;
        this.loadingAnimationElement.className = LOADING_COMPLETE_CLASS_FOR_ANIMATION;
    }
}

