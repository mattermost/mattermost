export type ThemeKey = 'denim' | 'sapphire' | 'quartz' | 'indigo' | 'onyx';

export type LegacyThemeType = 'Mattermost' | 'Organization' | 'Mattermost Dark' | 'Windows Dark';

export type ThemeType = 'Denim' | 'Sapphire' | 'Quartz' | 'Indigo' | 'Onyx';

export type Theme = {
    [key: string]: string | undefined;
    type?: ThemeType | 'custom';
    sidebarBg: string;
    sidebarText: string;
    sidebarUnreadText: string;
    sidebarTextHoverBg: string;
    sidebarTextActiveBorder: string;
    sidebarTextActiveColor: string;
    sidebarHeaderBg: string;
    sidebarTeamBarBg: string;
    sidebarHeaderTextColor: string;
    onlineIndicator: string;
    awayIndicator: string;
    dndIndicator: string;
    mentionBg: string;
    mentionBj: string;
    mentionColor: string;
    centerChannelBg: string;
    centerChannelColor: string;
    newMessageSeparator: string;
    linkColor: string;
    buttonBg: string;
    buttonColor: string;
    errorTextColor: string;
    mentionHighlightBg: string;
    mentionHighlightLink: string;
    codeTheme: string;
};
