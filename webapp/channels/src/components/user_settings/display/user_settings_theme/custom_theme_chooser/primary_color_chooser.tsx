// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import tinycolor from 'tinycolor2';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import ColorInput from 'components/color_input';
import CheckMarkIcon from 'components/widgets/icons/check_mark_icon';

// Pre-defined color swatches - 6 base colors in a single row
const COLOR_SWATCHES = [
    '#1c58d9', // Blue (Mattermost blue)
    '#39b886', // Green
    '#f2c230', // Yellow
    '#ff8800', // Orange
    '#e05253', // Red
    '#8c59d0', // Purple
];

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

// Inspired by Material 3 color system
// These are the tonal palette tone values for a standard Material 3 theme
const TONE_VALUES = {
    // Material 3 uses these standard tone values for different color roles
    PRIMARY: {
        light: {
            base: 40, // Primary color in light theme
            container: 90, // Container color in light theme
            onBase: 100, // Text on primary
            onContainer: 10, // Text on container
        },
        dark: {
            base: 80, // Primary color in dark theme
            container: 30, // Container color in dark theme
            onBase: 0, // Text on primary
            onContainer: 90, // Text on container
        },
    },
    NEUTRAL: {
        light: {
            surface: 98, // Surface colors
            background: 99, // Background
            onSurface: 10, // Text on surface
        },
        dark: {
            surface: 12, // Surface colors for dark theme
            background: 10, // Background for dark theme
            onSurface: 90, // Text on surface in dark theme
        },
    },
    ACCENT: {
        light: 65,
        dark: 70,
    },
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
    
    // Creates a tonal palette from a source color, similar to Material 3
    const createTonalPalette = (sourceColor: tinycolor.Instance) => {
        // Extract the base HSL values
        const hsl = sourceColor.toHsl();
        const hue = hsl.h;
        
        // Determine chroma (color intensity)
        // Material 3 does complex calculations for this, but we'll use a simplified approach
        const chroma = Math.min(hsl.s * 100, 48); // Cap at 48 like Material's primary palette
        
        // Create a tonal palette (colors that vary in tone but keep the same hue and chroma)
        const tonalPalette: {[key: number]: string} = {};
        
        // Generate shades from 0 (darkest) to 100 (lightest)
        for (let tone = 0; tone <= 100; tone += 10) {
            // Calculate saturation based on tone
            // Saturation is reduced at very light and dark tones
            const adjustedSaturation = Math.max(0, 
                chroma * (1 - Math.abs(tone - 50) / 70)
            ) / 100;
            
            // Calculate lightness directly from tone (0-100 scale)
            // This is a simplification of Material's HCT conversion
            const lightness = tone / 100;
            
            tonalPalette[tone] = tinycolor({
                h: hue,
                s: adjustedSaturation,
                l: lightness,
            }).toHexString();
        }
        
        return tonalPalette;
    };
    
    // Creates a neutral palette (low chroma colors) from a source color
    const createNeutralPalette = (sourceColor: tinycolor.Instance, chromaReduction = 0.9) => {
        const hsl = sourceColor.toHsl();
        const hue = hsl.h;
        
        // Significantly reduce the chroma for neutrals
        const chroma = Math.max(hsl.s * (1 - chromaReduction), 0.04); // Keep at least 4% saturation
        
        const neutralPalette: {[key: number]: string} = {};
        
        for (let tone = 0; tone <= 100; tone += 10) {
            // For neutrals, use even lower saturation at extremes
            const adjustedSaturation = chroma * (1 - Math.abs(tone - 50) / 90);
            const lightness = tone / 100;
            
            neutralPalette[tone] = tinycolor({
                h: hue,
                s: adjustedSaturation,
                l: lightness,
            }).toHexString();
        }
        
        return neutralPalette;
    };
    
    // Create a secondary palette with a slight hue shift
    const createSecondaryPalette = (sourceColor: tinycolor.Instance, hueShift = 40) => {
        const hsl = sourceColor.toHsl();
        const newHue = (hsl.h + hueShift) % 360;
        
        // Secondary colors use slightly lower chroma
        const newChroma = Math.min(hsl.s, 0.8) * 0.8;
        
        return createTonalPalette(tinycolor({h: newHue, s: newChroma, l: hsl.l}));
    };
    
    // Create a tertiary palette with a different hue shift
    const createTertiaryPalette = (sourceColor: tinycolor.Instance, hueShift = 80) => {
        const hsl = sourceColor.toHsl();
        const newHue = (hsl.h + hueShift) % 360;
        
        // Tertiary colors can have a bit more chroma than secondary
        const newChroma = Math.min(hsl.s, 0.85) * 0.85;
        
        return createTonalPalette(tinycolor({h: newHue, s: newChroma, l: hsl.l}));
    };
    
    // Function to apply color with selected theme mode using Material 3 principles
    const applyColorWithMode = (newColor: string, mode: string) => {
        const {theme} = props;
        
        // Parse the source color
        const sourceColor = tinycolor(newColor);
        
        // Create our tonal palettes
        const primaryPalette = createTonalPalette(sourceColor);
        const neutralPalette = createNeutralPalette(sourceColor);
        const secondaryPalette = createSecondaryPalette(sourceColor);
        const tertiaryPalette = createTertiaryPalette(sourceColor);
        
        // Create error palette (always using a reddish hue for semantic meaning)
        const errorPalette = createTonalPalette(tinycolor({h: 25, s: 0.84, l: 0.5}));
        
        // Define standard semantic colors that don't change with theme
        // Using standard colors for status indicators with slight adjustments to match theme
        const statusColors = {
            online: mode === 'light' ? '#06d6a0' : '#3db887', // Green
            away: mode === 'light' ? '#ffbc42' : '#e0b638',   // Yellow/Gold
            dnd: mode === 'light' ? '#f74343' : '#e05253',    // Red
        };
        
        let newTheme: Theme;
        
        if (mode === 'light') {
            // LIGHT MODE THEME GENERATION
            // Create a set of colors for each section of the UI using the Material 3 tonal palette approach

            // Calculate optimal text color for any background
            const getTextOnBgColor = (bgColor: string) => {
                return tinycolor(bgColor).isDark() ? '#ffffff' : '#1f2228';
            };

            // SIDEBAR COLORS - using primary colors for brand recognition
            const sidebarBg = primaryPalette[TONE_VALUES.PRIMARY.light.base]; // Primary color
            const sidebarText = getTextOnBgColor(sidebarBg);
            const sidebarUnreadText = sidebarText; // Same as regular text for consistency
            
            // Create a darker hover background from the primary color
            const sidebarTextHoverBg = tinycolor(sidebarBg).darken(10).toString();
            
            // Create a lighter shade of the primary color for the active border - better contrast
            const sidebarTextActiveBorder = tinycolor(sidebarBg).lighten(15).saturate(10).toString();
            const sidebarTextActiveColor = sidebarText;
            
            // Make sidebar header and team bar progressively darker for better contrast and hierarchy
            const sidebarHeaderBg = tinycolor(sidebarBg).darken(15).toString(); // Darker than base
            const sidebarTeamBarBg = tinycolor(sidebarBg).darken(25).toString(); // Even darker
            const sidebarHeaderTextColor = getTextOnBgColor(sidebarHeaderBg);

            // CENTER CHANNEL COLORS - neutral for content focus
            const centerChannelBg = neutralPalette[TONE_VALUES.NEUTRAL.light.background];
            const centerChannelColor = neutralPalette[TONE_VALUES.NEUTRAL.light.onSurface];
            
            // ACCENT COLORS - use primary color for better consistency
            const newMessageSeparator = sidebarBg; // Use the primary color for message separator
            
            // INDICATOR COLORS - semantic colors with slight adjustments
            const onlineIndicator = statusColors.online;
            const awayIndicator = statusColors.away;
            const dndIndicator = statusColors.dnd;
            
            // MENTION COLORS - use primary color for mentions for better consistency
            const mentionBg = sidebarBg; // Use the primary color for the mention background
            const mentionColor = sidebarText; // Use the contrasting text color
            
            // BUTTON AND LINK COLORS - using primary palette for consistency
            const buttonBg = primaryPalette[TONE_VALUES.PRIMARY.light.base];
            const buttonColor = getTextOnBgColor(buttonBg);
            const linkColor = primaryPalette[40];
            
            // ERROR AND HIGHLIGHT COLORS
            const errorTextColor = errorPalette[50];
            const mentionHighlightBg = tertiaryPalette[TONE_VALUES.PRIMARY.light.container];
            const mentionHighlightLink = linkColor;

            newTheme = {
                ...theme,
                type: 'custom',
                // Sidebar colors
                sidebarBg,
                sidebarText,
                sidebarUnreadText,
                sidebarTextHoverBg,
                sidebarTextActiveBorder,
                sidebarTextActiveColor,
                sidebarHeaderBg,
                sidebarTeamBarBg,
                sidebarHeaderTextColor,
                
                // Center channel
                centerChannelBg,
                centerChannelColor,
                newMessageSeparator,
                
                // Status indicators
                onlineIndicator,
                awayIndicator,
                dndIndicator,
                
                // Mentions and notifications
                mentionBg,
                mentionBj: mentionBg, // For backwards compatibility
                mentionColor,
                
                // Links and buttons
                linkColor,
                buttonBg,
                buttonColor,
                
                // Errors and highlights
                errorTextColor,
                mentionHighlightBg,
                mentionHighlightLink,
                
                // Code theme - preserve existing or default to light
                codeTheme: theme.codeTheme || 'github',
            };
        } else {
            // DARK MODE THEME GENERATION
            // Create a set of colors for each section using the Material 3 tonal palette approach for dark themes
            
            // Extract the hue from the source color for consistent color generation
            const hsl = sourceColor.toHsl();
            const hue = hsl.h;
            
            // Calculate optimal text color for any background
            const getTextOnBgColor = (bgColor: string) => {
                return tinycolor(bgColor).isDark() ? '#ffffff' : '#1f2228';
            };

            // SIDEBAR COLORS - using a colorful dark scheme with accents for highlights
            // Instead of pure neutral, use a slightly tinted dark color based on the primary hue
            const baseDarkColor = tinycolor({
                h: hue,           // Use the primary color's hue
                s: 0.20,          // Add a bit of saturation
                l: 0.15           // Keep it dark but not black
            }).toString();
            
            // Create a colorful but dark sidebar
            const sidebarBg = baseDarkColor;
            
            // Define sidebar colors
            const sidebarText = '#e9e9e9'; // Light text for dark background
            const sidebarUnreadText = '#ffffff'; // White for unread text to stand out
            
            // Create a subtle but visible hover background
            const sidebarTextHoverBg = tinycolor(sidebarBg).lighten(8).saturate(10).toString();
            
            // Use a more vibrant primary color as an accent in the dark theme
            const sidebarTextActiveBorder = tinycolor(primaryPalette[TONE_VALUES.PRIMARY.dark.base])
                .saturate(40)
                .lighten(5)
                .toString(); 
                
            const sidebarTextActiveColor = sidebarText;
            
            // Create depth with progressively different shades
            // For dark themes, make the header slightly different but not necessarily darker
            const sidebarHeaderBg = tinycolor({
                h: (hue + 5) % 360,  // Slight hue shift
                s: 0.20,             // Moderate saturation
                l: 0.12              // Dark but not black
            }).toString();
            
            // Team bar with another slight hue variation
            const sidebarTeamBarBg = tinycolor({
                h: (hue + 10) % 360, // More hue shift
                s: 0.15,             // Less saturation
                l: 0.10              // Darker but not black
            }).toString();
            const sidebarHeaderTextColor = sidebarText;

            // CENTER CHANNEL COLORS - colorful dark background with light text
            // Use a slightly different hue for the center to create subtle contrast with the sidebar
            const centerChannelBg = tinycolor({
                h: (hue - 5) % 360,  // Slight hue shift in opposite direction
                s: 0.10,             // Less saturation than sidebar for content focus
                l: 0.18              // Slightly lighter than sidebar, but still dark
            }).toString();
            
            const centerChannelColor = '#e9e9e9'; // Light gray text for readability
            
            // ACCENT COLORS - use a vibrant version of the primary color
            // Make the new message separator more colorful by increasing saturation
            const newMessageSeparator = tinycolor(primaryPalette[TONE_VALUES.PRIMARY.dark.base])
                .saturate(30)
                .lighten(10)
                .toString();
            
            // STATUS INDICATORS - semantic colors adjusted for dark theme
            const onlineIndicator = statusColors.online;
            const awayIndicator = statusColors.away;
            const dndIndicator = statusColors.dnd;
            
            // MENTION COLORS - use vibrant, eye-catching colors for mentions
            // Mentions should stand out in dark mode
            const mentionBg = tinycolor(primaryPalette[TONE_VALUES.PRIMARY.dark.base])
                .saturate(50)  // Very saturated for high visibility
                .lighten(5)    // Slightly lighter
                .toString();
            
            const mentionColor = getTextOnBgColor(mentionBg); // Auto-calculate for proper contrast
            
            // BUTTON AND LINK COLORS
            // Make buttons vibrant and readable
            const buttonBg = tinycolor(primaryPalette[TONE_VALUES.PRIMARY.dark.base])
                .saturate(30)
                .lighten(5)
                .toString(); // More saturated buttons
                
            const buttonColor = getTextOnBgColor(buttonBg); // Auto-calculate for proper contrast
            
            // Make links more colorful and noticeable
            const linkColor = tinycolor(primaryPalette[TONE_VALUES.PRIMARY.dark.base])
                .saturate(40)
                .lighten(20)
                .toString(); // Much brighter, more saturated links in dark mode
            
            // ERROR AND HIGHLIGHT COLORS
            const errorTextColor = errorPalette[70]; // Brighter in dark mode
            
            // Use a more colorful highlight background that stands out
            const mentionHighlightBg = tinycolor({
                h: hue, // Use primary color hue
                s: 0.40, // Higher saturation for more color
                l: 0.20 // Dark enough for contrast but still visible
            }).toString();
            
            // Use the same link color for consistency
            const mentionHighlightLink = linkColor;

            newTheme = {
                ...theme,
                type: 'custom',
                // Sidebar colors
                sidebarBg,
                sidebarText,
                sidebarUnreadText,
                sidebarTextHoverBg,
                sidebarTextActiveBorder,
                sidebarTextActiveColor,
                sidebarHeaderBg,
                sidebarTeamBarBg,
                sidebarHeaderTextColor,
                
                // Center channel
                centerChannelBg,
                centerChannelColor,
                newMessageSeparator,
                
                // Status indicators
                onlineIndicator,
                awayIndicator,
                dndIndicator,
                
                // Mentions
                mentionBg,
                mentionBj: mentionBg, // For backwards compatibility - must match mentionBg
                mentionColor,
                
                // Links and buttons
                linkColor,
                buttonBg,
                buttonColor,
                
                // Errors and highlights
                errorTextColor,
                mentionHighlightBg,
                mentionHighlightLink,
                
                // Code theme - preserve existing or default to dark
                codeTheme: theme.codeTheme || 'solarized-dark',
            };
        }
        
        // Ensure all theme properties have valid hex values
        const validTheme = {...newTheme};
        
        // Validate each property to ensure it's a proper hex color
        Object.keys(validTheme).forEach(key => {
            // Skip non-color properties
            if (key === 'type' || key === 'codeTheme') {
                return;
            }
            
            const value = validTheme[key];
            
            // Handle undefined or non-string values
            if (typeof value !== 'string') {
                validTheme[key] = key.includes('Bg') ? '#ffffff' : '#000000';
                return;
            }
            
            // Convert any non-hex colors to hex format
            if (!value.startsWith('#')) {
                const color = tinycolor(value);
                if (color.isValid()) {
                    validTheme[key] = color.toHexString();
                } else {
                    validTheme[key] = key.includes('Bg') ? '#ffffff' : '#000000';
                }
            }
        });
        
        // Pass the validated theme changes up to the parent component
        props.onChange(validTheme);
    };
    
    // Main color change handler
    // Keep track of the user's selected color for display purposes
    const [primaryColor, setPrimaryColor] = useState(
        // Initialize with the current theme's primary color (sidebarBg or buttonBg)
        (() => {
            if (themeMode === 'dark') {
                return props.theme.buttonBg && tinycolor(props.theme.buttonBg).isValid() ? 
                    props.theme.buttonBg : '#4cbba4';
            } else {
                return props.theme.sidebarBg && tinycolor(props.theme.sidebarBg).isValid() ? 
                    props.theme.sidebarBg : '#1c58d9';
            }
        })()
    );
    
    const handleColorChange = (newColor: string) => {
        // Update the displayed color
        setPrimaryColor(newColor);
        
        // Generate theme colors in the background
        applyColorWithMode(newColor, themeMode);
    };

    const handleThemeModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMode = e.target.value;
        setThemeMode(newMode);
        
        // Use the user's selected color when switching modes
        // This preserves their color choice when toggling between light/dark
        try {
            // Generate a new theme with the selected mode but keep the same primary color
            applyColorWithMode(primaryColor, newMode);
        } catch (error) {
            console.error('Error changing theme mode:', error);
            // Use default colors if there's an error
            applyColorWithMode(newMode === 'light' ? '#145dbf' : '#4cbba4', newMode);
        }
    };

    // Theme preview removed as requested

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
                        value={tinycolor(primaryColor).toHexString()}
                        onChange={handleColorChange}
                    />
                </div>
                
                {/* Color Swatches */}
                <div className="color-swatches">
                    <div className="color-swatches-label">
                        <FormattedMessage
                            id="user.settings.custom_theme.colorSwatches"
                            defaultMessage="Color Presets:"
                        />
                    </div>
                    <div className="color-swatch-container">
                        {COLOR_SWATCHES.map((color) => {
                            // Check if this swatch is the user's selected color
                            const isSelected = tinycolor(color).toHexString() === tinycolor(primaryColor).toHexString();
                            
                            return (
                                <button
                                    key={color}
                                    type="button"
                                    className={`color-swatch ${isSelected ? 'selected' : ''}`}
                                    style={{backgroundColor: color}}
                                    aria-label={`Color: ${color}`}
                                    title={color}
                                    onClick={() => handleColorChange(color)}
                                >
                                    {isSelected && <CheckMarkIcon/>}
                                </button>
                            );
                        })}
                    </div>
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