// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import tinycolor from 'tinycolor2';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import ColorInput from 'components/color_input';

// Light theme template
const lightThemeBase = {
    centerChannelBg: '#ffffff',
    centerChannelColor: '#3d3c40',
    newMessageSeparator: '#ff8800',
    errorTextColor: '#fd5960',
    mentionHighlightBg: '#ffe577',
    codeTheme: 'github',
    onlineIndicator: '#06d6a0',
    awayIndicator: '#ffbc42',
    dndIndicator: '#f74343',
};

// Dark theme template
const darkThemeBase = {
    centerChannelBg: '#2f3e4e',
    centerChannelColor: '#dddddd',
    newMessageSeparator: '#5de5da',
    errorTextColor: '#ff6461',
    mentionHighlightBg: '#984063',
    codeTheme: 'solarized-dark',
    onlineIndicator: '#65dcc8',
    awayIndicator: '#c1b966',
    dndIndicator: '#e81023',
};

type Props = {
    theme: Theme;
    onChange: (theme: Theme) => void;
}

export default function PrimaryColorChooser(props: Props) {
    const [themeMode, setThemeMode] = useState(
        // Default to dark mode if the current theme centerChannelBg is dark
        tinycolor(props.theme.centerChannelBg || '#ffffff').isDark() ? 'dark' : 'light'
    );
    
    // Function to apply color with selected theme mode
    const applyColorWithMode = (newColor: string, mode: string) => {
        const {theme} = props;
        
        // Parse the new color
        const primaryColor = tinycolor(newColor);
        const isPrimaryLight = primaryColor.isLight();
        
        // Get HSL values to work with
        const hsl = primaryColor.toHsl();
        const hue = hsl.h;
        
        let newTheme: Theme;
        
        if (mode === 'light') {
            // LIGHT MODE THEME GENERATION
            
            // Create variations of the primary color with the same hue but different saturation/lightness
            const generateColor = (lightness: number, saturation: number = hsl.s) => {
                return tinycolor({h: hue, s: saturation, l: lightness}).toHexString();
            };
            
            // Light theme - sidebar is the primary color
            const sidebarBg = newColor; // Primary color
            const sidebarHeaderBg = generateColor(0.25, 0.8); // Slightly darker than sidebar
            const sidebarTeamBarBg = generateColor(0.15, 0.8); // Even darker for team bar
            const sidebarTextHoverBg = generateColor(0.40, 0.7); // Lighter for hover
            
            // Accent colors - subtle shift for visual interest
            const accentHue = (hue + 15) % 360; // Small hue shift
            const generateAccent = (lightness: number, saturation: number = 0.8) => {
                return tinycolor({h: accentHue, s: saturation, l: lightness}).toHexString();
            };
            
            // Link color - directly based on primary color, adjusted for visibility
            const linkColor = tinycolor(newColor).darken(10).saturate(10).toHexString();
            
            // Contrast color for text on primary color
            const contrastColor = isPrimaryLight ? '#151515' : '#ffffff';
            
            // Status indicators - standard colors with slight adjustments
            const onlineColor = '#06d6a0'; // Standard green
            const awayColor = '#ffbc42';  // Standard yellow/orange
            const dndColor = '#f74343';   // Standard red
            
            newTheme = {
                ...theme,
                type: 'custom',
                // Sidebar
                sidebarBg: sidebarBg,
                sidebarText: contrastColor,
                sidebarUnreadText: contrastColor,
                sidebarTextHoverBg: sidebarTextHoverBg,
                sidebarTextActiveBorder: '#579eff', // Consistent blue accent
                sidebarTextActiveColor: contrastColor,
                sidebarHeaderBg: sidebarHeaderBg,
                sidebarTeamBarBg: sidebarTeamBarBg,
                sidebarHeaderTextColor: contrastColor,
                // Status indicators
                onlineIndicator: onlineColor,
                awayIndicator: awayColor,
                dndIndicator: dndColor,
                // Mentions
                mentionBg: contrastColor,
                mentionBj: contrastColor, // For backwards compatibility
                mentionColor: sidebarBg,
                // Center channel
                centerChannelBg: '#ffffff',
                centerChannelColor: '#3d3c40',
                newMessageSeparator: '#ff8800',
                // Links and buttons
                linkColor: linkColor,
                buttonBg: sidebarBg,
                buttonColor: contrastColor,
                // Errors and mentions
                errorTextColor: '#fd5960',
                mentionHighlightBg: '#ffe577',
                mentionHighlightLink: linkColor, // Ensure highlight links match normal links
                // Code theme - preserve the existing code theme if it exists
                codeTheme: theme.codeTheme || 'github',
            };
        } else {
            // DARK MODE THEME GENERATION
            // Create a dark theme using the selected color as an accent
            
            // Make sure the primary color is vibrant and visible enough for buttons and accents
            // While maintaining its original hue for color identity
            const adjustedPrimary = tinycolor(newColor);
            
            // If the color is too dark, brighten it for better visibility
            if (adjustedPrimary.getBrightness() < 100) {
                adjustedPrimary.brighten(20).saturate(20);
            }
            
            // Create color generator functions for consistent theme colors
            const generateColor = (lightness: number, saturation: number = hsl.s) => {
                return tinycolor({h: hue, s: saturation, l: lightness}).toHexString();
            };
            
            // Dark sidebar colors - always use a dark neutral base that works with any accent color
            const darkBase = tinycolor({h: hue, s: 0.20, l: 0.14}).toHexString();
            const sidebarBg = darkBase;
            const sidebarHeaderBg = tinycolor(darkBase).darken(2).toHexString();
            const sidebarTeamBarBg = tinycolor(darkBase).darken(5).toHexString();
            
            // Hover state - subtly lighter than the base
            const sidebarTextHoverBg = tinycolor(darkBase).lighten(10).setAlpha(0.3).toHexString();
            
            // Text color is always white in dark mode
            const contrastColor = '#ffffff';
            
            // Use the adjusted primary color for accents and buttons
            const accentColor = adjustedPrimary.toHexString();
            
            // Create link colors directly from the primary color
            // Just make them brighter and slightly more saturated for visibility
            const linkColor = tinycolor(newColor).brighten(20).saturate(10).toHexString();
            
            // Status indicators - standard colors for semantic meaning but adjusted for dark mode
            const onlineColor = '#3db887'; // Slightly desaturated green
            const awayColor = '#e0b638';   // Gold
            const dndColor = '#e05253';    // Red
            
            // Mention colors - bright, noticeable color
            const mentionBg = tinycolor(newColor).saturate(30).lighten(5).toHexString();
            
            // Highlight colors - should stand out against dark backgrounds
            const mentionHighlightBg = tinycolor({h: (hue + 30) % 360, s: 0.5, l: 0.3}).toHexString();
            
            newTheme = {
                ...theme,
                type: 'custom',
                // Sidebar
                sidebarBg: sidebarBg,
                sidebarText: contrastColor,
                sidebarUnreadText: contrastColor,
                sidebarTextHoverBg: sidebarTextHoverBg,
                sidebarTextActiveBorder: accentColor,
                sidebarTextActiveColor: contrastColor,
                sidebarHeaderBg: sidebarHeaderBg,
                sidebarTeamBarBg: sidebarTeamBarBg,
                sidebarHeaderTextColor: contrastColor,
                // Status indicators
                onlineIndicator: onlineColor,
                awayIndicator: awayColor,
                dndIndicator: dndColor,
                // Mentions
                mentionBg: mentionBg,
                mentionBj: mentionBg, // For backwards compatibility
                mentionColor: '#ffffff',
                // Center channel - slightly brighter and less saturated for better readability
                centerChannelBg: tinycolor({h: hue, s: 0.06, l: 0.18}).toHexString(),
                centerChannelColor: '#eeeeee',
                newMessageSeparator: accentColor,
                // Links and buttons - ensure high contrast
                linkColor: linkColor,
                buttonBg: accentColor, // Using the adjusted primary color
                buttonColor: '#ffffff', // Always white text on buttons for maximum contrast
                mentionHighlightLink: linkColor, // Ensure highlight links match normal links
                // Errors and mentions - using warm colors that stand out but aren't too jarring
                errorTextColor: '#eb6260',
                mentionHighlightBg: mentionHighlightBg,
                // Code theme - preserve the existing code theme if it exists
                codeTheme: theme.codeTheme || 'solarized-dark',
            };
        }
        
        props.onChange(newTheme);
    };
    
    // Main color change handler
    const handleColorChange = (newColor: string) => {
        applyColorWithMode(newColor, themeMode);
    };

    const handleThemeModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMode = e.target.value;
        setThemeMode(newMode);
        
        // Apply change with the current color, passing the new mode directly
        applyColorWithMode(props.theme.sidebarBg || "#145dbf", newMode);
    };

    return (
        <div className="col-sm-12">
            <div 
                style={{
                    padding: '1rem', 
                    marginTop: '1rem',
                    marginBottom: '2rem', 
                    backgroundColor: props.theme.centerChannelBg, 
                    borderRadius: '4px', 
                    border: `1px solid ${props.theme.centerChannelColor}25`,
                    color: props.theme.centerChannelColor
                }}>
                
                <label style={{fontWeight: 'bold', marginBottom: '0.5rem', color: props.theme.centerChannelColor}}>
                    <FormattedMessage
                        id="user.settings.custom_theme.primaryColor"
                        defaultMessage="Primary Color"
                    />
                </label>
                
                <div className="help-text" style={{marginBottom: '1rem'}}>
                    <FormattedMessage
                        id="user.settings.custom_theme.primaryColorHelp"
                        defaultMessage="Select a primary color to auto-generate your theme colors. This will update all color settings at once."
                    />
                </div>

                <div style={{marginBottom: '1rem'}}>
                    <ColorInput
                        id="primaryColor"
                        value={themeMode === 'dark' ? (tinycolor(props.theme.buttonBg).isValid() ? props.theme.buttonBg : '#4cbba4') : (props.theme.sidebarBg || "#145dbf")}
                        onChange={handleColorChange}
                    />
                </div>
                
                <div className="theme-mode-selector" style={{marginBottom: '1rem'}}>
                    <label style={{fontWeight: 'bold', marginBottom: '0.5rem', color: props.theme.centerChannelColor}}>
                        <FormattedMessage
                            id="user.settings.custom_theme.themeMode"
                            defaultMessage="Theme Mode:"
                        />
                    </label>
                    <div className="radio-group" style={{display: 'flex', gap: '1rem', color: props.theme.centerChannelColor}}>
                        <div className="radio">
                            <label>
                                <input
                                    id="lightMode"
                                    type="radio"
                                    name="themeMode"
                                    value="light"
                                    checked={themeMode === 'light'}
                                    onChange={handleThemeModeChange}
                                />
                                <FormattedMessage
                                    id="user.settings.custom_theme.lightMode"
                                    defaultMessage="Light"
                                />
                            </label>
                        </div>
                        <div className="radio">
                            <label>
                                <input
                                    id="darkMode"
                                    type="radio"
                                    name="themeMode"
                                    value="dark"
                                    checked={themeMode === 'dark'}
                                    onChange={handleThemeModeChange}
                                />
                                <FormattedMessage
                                    id="user.settings.custom_theme.darkMode"
                                    defaultMessage="Dark"
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}