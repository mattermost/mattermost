const MOBILE_SCREEN_WIDTH = 768;

export const isMobile = () => {
    return window.innerWidth <= MOBILE_SCREEN_WIDTH;
};
