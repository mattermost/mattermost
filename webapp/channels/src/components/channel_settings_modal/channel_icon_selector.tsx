// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';

import type {CustomSvg} from './icon_libraries/custom_svgs';
import {
    getCustomSvgsFromServer,
    addCustomSvgToServer,
    updateCustomSvgOnServer,
    deleteCustomSvgFromServer,
    decodeSvgFromBase64,
    sanitizeSvg,
    normalizeSvgColors,
    normalizeSvgViewBox,
    encodeSvgToBase64,
} from './icon_libraries/custom_svgs';
import {parseIconValue, formatIconValue} from './icon_libraries/types';
import CustomSvgModal from './custom_svg_modal';

import './channel_icon_selector.scss';

// Curated list of icons suitable for channels, organized by category
const CHANNEL_ICONS: Record<string, string[]> = {
    general: [
        'globe', 'lock-outline', 'star', 'star-outline', 'heart', 'heart-outline',
        'bookmark', 'bookmark-outline', 'flag', 'flag-outline', 'fire', 'lightning-bolt',
    ],
    communication: [
        'message-text-outline', 'comment-outline', 'forum', 'email-outline', 'phone',
        'cellphone', 'bell-outline', 'bell-ring-outline', 'bullhorn', 'broadcast',
    ],
    work: [
        'briefcase-outline', 'folder-outline', 'file-document-outline', 'clipboard-text-outline',
        'calendar', 'clock-outline', 'chart-bar', 'chart-line', 'presentation',
        'target', 'trophy-outline', 'medal-outline',
    ],
    development: [
        'code-tags', 'code-brackets', 'code-block', 'console', 'github-circle',
        'bug', 'flask-outline', 'cog-outline', 'wrench-outline', 'hammer',
        'server-outline', 'database', 'api',
    ],
    media: [
        'image-outline', 'camera-outline', 'video-outline', 'music', 'microphone',
        'headphones', 'play-circle-outline', 'movie-open-outline',
    ],
    places: [
        'home-outline', 'office-building-outline', 'store-outline', 'map-marker-outline',
        'earth', 'airplane', 'car', 'bus', 'train',
    ],
    objects: [
        'lightbulb-outline', 'key-variant', 'lock', 'shield-outline', 'gift-outline',
        'cube-outline', 'puzzle-outline', 'palette-outline', 'brush', 'pencil',
    ],
    nature: [
        'leaf-outline', 'flower-outline', 'tree', 'weather-sunny', 'weather-cloudy',
        'weather-lightning', 'water', 'paw', 'cat', 'dog',
    ],
    people: [
        'account-outline', 'account-multiple-outline', 'account-group-outline',
        'hand-wave', 'emoticon-outline', 'emoticon-happy-outline', 'human-greeting',
    ],
    symbols: [
        'alert-outline', 'information-outline', 'help-circle-outline', 'check-circle-outline',
        'close-circle-outline', 'plus-circle-outline', 'minus-circle-outline',
        'arrow-right-circle-outline', 'refresh', 'sync',
    ],
};

// Flatten all icons for search
const ALL_ICONS = Object.values(CHANNEL_ICONS).flat();

// Special category ID for custom SVGs
const CUSTOM_SVG_CATEGORY = 'custom_svg';

type Props = {
    selectedIcon: string;
    onSelectIcon: (icon: string) => void;
    disabled?: boolean;
}

// Component to render a custom SVG icon in the selector
function CustomSvgIcon({svg, size = 20}: {svg: CustomSvg; size?: number}) {
    const rawSvg = decodeSvgFromBase64(svg.svg);
    let displaySvg = sanitizeSvg(rawSvg);
    if (svg.normalizeColor) {
        displaySvg = normalizeSvgColors(displaySvg);
    }

    // Normalize viewBox for consistent sizing and centering
    displaySvg = normalizeSvgViewBox(displaySvg);

    // Add size to SVG
    displaySvg = displaySvg.replace(/<svg/, `<svg width="${size}" height="${size}"`);

    return (
        <i
            className='icon sidebar-channel-icon sidebar-channel-icon--custom'
            dangerouslySetInnerHTML={{__html: displaySvg}}
        />
    );
}

export default function ChannelIconSelector({
    selectedIcon,
    onSelectIcon,
    disabled = false,
}: Props) {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [customSvgs, setCustomSvgs] = useState<CustomSvg[]>([]);
    const [showCustomSvgModal, setShowCustomSvgModal] = useState(false);
    const [editingCustomSvg, setEditingCustomSvg] = useState<CustomSvg | undefined>(undefined);

    // Load custom SVGs from server when component mounts
    useEffect(() => {
        const loadCustomSvgs = async () => {
            try {
                const svgs = await getCustomSvgsFromServer();
                setCustomSvgs(svgs);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to load custom SVGs:', error);
            }
        };
        loadCustomSvgs();
    }, []);

    // Refresh custom SVGs from server
    const refreshCustomSvgs = useCallback(async () => {
        try {
            const svgs = await getCustomSvgsFromServer();
            setCustomSvgs(svgs);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to refresh custom SVGs:', error);
        }
    }, []);

    // Check if the selected icon is a custom SVG (svg:base64 format)
    // Try to match against our custom SVG library by comparing base64 content
    const selectedCustomSvg = useMemo(() => {
        const parsed = parseIconValue(selectedIcon);
        if (parsed.format === 'svg' && parsed.name) {
            // Try to find a matching custom SVG by comparing base64 content
            return customSvgs.find((svg) => {
                // Get the processed base64 that would be stored
                let processedSvg = decodeSvgFromBase64(svg.svg);
                processedSvg = sanitizeSvg(processedSvg);
                if (svg.normalizeColor) {
                    processedSvg = normalizeSvgColors(processedSvg);
                }
                const processedBase64 = encodeSvgToBase64(processedSvg);
                return processedBase64 === parsed.name;
            });
        }
        return undefined;
    }, [selectedIcon, customSvgs]);

    // Filter icons based on search term and active category
    const filteredIcons = useMemo(() => {
        if (activeCategory === CUSTOM_SVG_CATEGORY) {
            return [];
        }
        if (!searchTerm.trim()) {
            if (activeCategory) {
                return CHANNEL_ICONS[activeCategory] || [];
            }
            return ALL_ICONS;
        }
        const term = searchTerm.toLowerCase();
        return ALL_ICONS.filter((icon) => icon.toLowerCase().includes(term));
    }, [searchTerm, activeCategory]);

    // Filter custom SVGs based on search term
    const filteredCustomSvgs = useMemo(() => {
        if (!searchTerm.trim()) {
            if (activeCategory === CUSTOM_SVG_CATEGORY || activeCategory === null) {
                return customSvgs;
            }
            return [];
        }
        const term = searchTerm.toLowerCase();
        return customSvgs.filter((svg) => svg.name.toLowerCase().includes(term));
    }, [searchTerm, activeCategory, customSvgs]);

    const handleIconClick = useCallback((icon: string) => {
        onSelectIcon(icon === selectedIcon ? '' : icon);
        setIsOpen(false);
        setSearchTerm('');
        setActiveCategory(null);
    }, [selectedIcon, onSelectIcon]);

    const handleCustomSvgClick = useCallback((svg: CustomSvg) => {
        // Process the SVG and store as svg:base64 format for portability
        let processedSvg = decodeSvgFromBase64(svg.svg);
        processedSvg = sanitizeSvg(processedSvg);
        if (svg.normalizeColor) {
            processedSvg = normalizeSvgColors(processedSvg);
        }
        const base64 = encodeSvgToBase64(processedSvg);
        const value = formatIconValue('svg', base64);

        // Toggle off if clicking the same icon
        const isCurrentlySelected = selectedCustomSvg?.id === svg.id;
        onSelectIcon(isCurrentlySelected ? '' : value);
        setIsOpen(false);
        setSearchTerm('');
        setActiveCategory(null);
    }, [selectedCustomSvg, onSelectIcon]);

    const handleClearIcon = useCallback(() => {
        onSelectIcon('');
    }, [onSelectIcon]);

    const handleAddCustomSvg = useCallback(() => {
        setEditingCustomSvg(undefined);
        setShowCustomSvgModal(true);
    }, []);

    const handleEditCustomSvg = useCallback((svg: CustomSvg, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCustomSvg(svg);
        setShowCustomSvgModal(true);
    }, []);

    const handleDeleteCustomSvg = useCallback(async (svg: CustomSvg, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(formatMessage({id: 'channel_icon_selector.confirm_delete', defaultMessage: 'Delete "{name}"?'}, {name: svg.name}))) {
            try {
                await deleteCustomSvgFromServer(svg.id);
                await refreshCustomSvgs();

                // Clear selection if the deleted SVG was selected
                if (selectedCustomSvg?.id === svg.id) {
                    onSelectIcon('');
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to delete custom SVG:', error);
            }
        }
    }, [formatMessage, refreshCustomSvgs, selectedCustomSvg, onSelectIcon]);

    const handleSaveCustomSvg = useCallback(async (data: {name: string; svg: string; normalizeColor: boolean}) => {
        try {
            if (editingCustomSvg) {
                await updateCustomSvgOnServer(editingCustomSvg.id, data);
                await refreshCustomSvgs();
            } else {
                const newSvg = await addCustomSvgToServer(data);
                await refreshCustomSvgs();

                // Auto-select the newly created SVG using svg:base64 format
                let processedSvg = decodeSvgFromBase64(newSvg.svg);
                processedSvg = sanitizeSvg(processedSvg);
                if (newSvg.normalizeColor) {
                    processedSvg = normalizeSvgColors(processedSvg);
                }
                const base64 = encodeSvgToBase64(processedSvg);
                onSelectIcon(formatIconValue('svg', base64));
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to save custom SVG:', error);
        }
    }, [editingCustomSvg, refreshCustomSvgs, onSelectIcon]);

    const categoryNames: Record<string, string> = {
        general: formatMessage({id: 'channel_icon_selector.category.general', defaultMessage: 'General'}),
        communication: formatMessage({id: 'channel_icon_selector.category.communication', defaultMessage: 'Communication'}),
        work: formatMessage({id: 'channel_icon_selector.category.work', defaultMessage: 'Work'}),
        development: formatMessage({id: 'channel_icon_selector.category.development', defaultMessage: 'Development'}),
        media: formatMessage({id: 'channel_icon_selector.category.media', defaultMessage: 'Media'}),
        places: formatMessage({id: 'channel_icon_selector.category.places', defaultMessage: 'Places'}),
        objects: formatMessage({id: 'channel_icon_selector.category.objects', defaultMessage: 'Objects'}),
        nature: formatMessage({id: 'channel_icon_selector.category.nature', defaultMessage: 'Nature'}),
        people: formatMessage({id: 'channel_icon_selector.category.people', defaultMessage: 'People'}),
        symbols: formatMessage({id: 'channel_icon_selector.category.symbols', defaultMessage: 'Symbols'}),
        [CUSTOM_SVG_CATEGORY]: formatMessage({id: 'channel_icon_selector.category.custom_svg', defaultMessage: 'Custom SVG'}),
    };

    // Get display label for the selected icon
    const getSelectedLabel = () => {
        if (selectedCustomSvg) {
            return selectedCustomSvg.name;
        }
        if (selectedIcon) {
            const parsed = parseIconValue(selectedIcon);
            if (parsed.format === 'svg') {
                return formatMessage({id: 'channel_icon_selector.custom_svg_label', defaultMessage: 'Custom SVG'});
            }
            if (parsed.format !== 'none') {
                return parsed.name;
            }
            return selectedIcon;
        }
        return formatMessage({id: 'channel_icon_selector.default', defaultMessage: 'Default'});
    };

    // Render the preview icon
    const renderPreviewIcon = () => {
        if (selectedCustomSvg) {
            return <CustomSvgIcon svg={selectedCustomSvg}/>;
        }
        if (selectedIcon) {
            const parsed = parseIconValue(selectedIcon);
            // Handle svg:base64 format (custom SVG not in library)
            if (parsed.format === 'svg' && parsed.name) {
                try {
                    let svgContent = decodeSvgFromBase64(parsed.name);
                    svgContent = sanitizeSvg(svgContent);
                    // Normalize viewBox for consistent sizing and centering
                    svgContent = normalizeSvgViewBox(svgContent);
                    svgContent = svgContent.replace(/<svg/, '<svg width="20" height="20"');
                    return (
                        <i
                            className='icon sidebar-channel-icon sidebar-channel-icon--custom'
                            dangerouslySetInnerHTML={{__html: svgContent}}
                        />
                    );
                } catch {
                    return <i className='icon icon-globe'/>;
                }
            }
            return <i className={`icon icon-${selectedIcon}`}/>;
        }
        return <i className='icon icon-globe'/>;
    };

    return (
        <div className='ChannelIconSelector'>
            <div className='ChannelIconSelector__preview'>
                <button
                    type='button'
                    className='ChannelIconSelector__previewButton'
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                    aria-label={formatMessage({id: 'channel_icon_selector.select', defaultMessage: 'Select channel icon'})}
                >
                    {renderPreviewIcon()}
                    <span className='ChannelIconSelector__previewLabel'>
                        {getSelectedLabel()}
                    </span>
                    <i className={`icon icon-chevron-${isOpen ? 'up' : 'down'}`}/>
                </button>
                {selectedIcon && !disabled && (
                    <button
                        type='button'
                        className='ChannelIconSelector__clearButton style--none'
                        onClick={handleClearIcon}
                        aria-label={formatMessage({id: 'channel_icon_selector.clear', defaultMessage: 'Clear icon'})}
                    >
                        <i className='icon icon-close-circle'/>
                    </button>
                )}
            </div>

            {isOpen && (
                <div className='ChannelIconSelector__dropdown'>
                    <div className='ChannelIconSelector__search'>
                        <i className='icon icon-magnify'/>
                        <input
                            type='text'
                            placeholder={formatMessage({id: 'channel_icon_selector.search', defaultMessage: 'Search icons...'})}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setActiveCategory(null);
                            }}
                            autoFocus={true}
                        />
                        {searchTerm && (
                            <button
                                type='button'
                                className='style--none'
                                onClick={() => setSearchTerm('')}
                            >
                                <i className='icon icon-close'/>
                            </button>
                        )}
                    </div>

                    {!searchTerm && (
                        <div className='ChannelIconSelector__categories'>
                            <button
                                type='button'
                                className={`ChannelIconSelector__categoryButton ${activeCategory === null ? 'active' : ''}`}
                                onClick={() => setActiveCategory(null)}
                            >
                                {formatMessage({id: 'channel_icon_selector.all', defaultMessage: 'All'})}
                            </button>
                            {Object.keys(CHANNEL_ICONS).map((category) => (
                                <button
                                    key={category}
                                    type='button'
                                    className={`ChannelIconSelector__categoryButton ${activeCategory === category ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(category)}
                                >
                                    {categoryNames[category]}
                                </button>
                            ))}
                            <button
                                type='button'
                                className={`ChannelIconSelector__categoryButton ChannelIconSelector__categoryButton--custom ${activeCategory === CUSTOM_SVG_CATEGORY ? 'active' : ''}`}
                                onClick={() => setActiveCategory(CUSTOM_SVG_CATEGORY)}
                            >
                                <i className='icon icon-vector-square'/>
                                {categoryNames[CUSTOM_SVG_CATEGORY]}
                                {customSvgs.length > 0 && (
                                    <span className='ChannelIconSelector__categoryCount'>
                                        {customSvgs.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}

                    <div className='ChannelIconSelector__icons'>
                        {/* Show custom SVGs if in custom category or searching */}
                        {(activeCategory === CUSTOM_SVG_CATEGORY || activeCategory === null || searchTerm) && filteredCustomSvgs.length > 0 && (
                            <>
                                {(activeCategory === null && !searchTerm) && (
                                    <div className='ChannelIconSelector__sectionHeader'>
                                        {formatMessage({id: 'channel_icon_selector.custom_svgs', defaultMessage: 'Custom SVGs'})}
                                    </div>
                                )}
                                {filteredCustomSvgs.map((svg) => (
                                    <div
                                        key={svg.id}
                                        className={`ChannelIconSelector__customSvgItem ${selectedCustomSvg?.id === svg.id ? 'selected' : ''}`}
                                    >
                                        <button
                                            type='button'
                                            className='ChannelIconSelector__iconButton'
                                            onClick={() => handleCustomSvgClick(svg)}
                                            title={svg.name}
                                            aria-label={svg.name}
                                        >
                                            <CustomSvgIcon svg={svg}/>
                                        </button>
                                        <div className='ChannelIconSelector__customSvgActions'>
                                            <button
                                                type='button'
                                                className='ChannelIconSelector__customSvgAction'
                                                onClick={(e) => handleEditCustomSvg(svg, e)}
                                                title={formatMessage({id: 'channel_icon_selector.edit', defaultMessage: 'Edit'})}
                                            >
                                                <i className='icon icon-pencil-outline'/>
                                            </button>
                                            <button
                                                type='button'
                                                className='ChannelIconSelector__customSvgAction ChannelIconSelector__customSvgAction--delete'
                                                onClick={(e) => handleDeleteCustomSvg(svg, e)}
                                                title={formatMessage({id: 'channel_icon_selector.delete', defaultMessage: 'Delete'})}
                                            >
                                                <i className='icon icon-trash-can-outline'/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Add new custom SVG button */}
                        {(activeCategory === CUSTOM_SVG_CATEGORY || activeCategory === null) && !searchTerm && (
                            <button
                                type='button'
                                className='ChannelIconSelector__addCustomSvg'
                                onClick={handleAddCustomSvg}
                                title={formatMessage({id: 'channel_icon_selector.add_custom_svg', defaultMessage: 'Add custom SVG'})}
                            >
                                <i className='icon icon-plus'/>
                            </button>
                        )}

                        {/* Section divider if showing both custom and regular icons */}
                        {activeCategory === null && !searchTerm && filteredCustomSvgs.length > 0 && (
                            <div className='ChannelIconSelector__sectionHeader'>
                                {formatMessage({id: 'channel_icon_selector.built_in_icons', defaultMessage: 'Built-in Icons'})}
                            </div>
                        )}

                        {/* Regular icons */}
                        {filteredIcons.length === 0 && filteredCustomSvgs.length === 0 && activeCategory !== CUSTOM_SVG_CATEGORY ? (
                            <div className='ChannelIconSelector__noResults'>
                                {formatMessage({id: 'channel_icon_selector.no_results', defaultMessage: 'No icons found'})}
                            </div>
                        ) : (
                            filteredIcons.map((icon) => (
                                <button
                                    key={icon}
                                    type='button'
                                    className={`ChannelIconSelector__iconButton ${selectedIcon === icon ? 'selected' : ''}`}
                                    onClick={() => handleIconClick(icon)}
                                    title={icon}
                                    aria-label={icon}
                                >
                                    <i className={`icon icon-${icon}`}/>
                                </button>
                            ))
                        )}

                        {/* Empty state for custom SVG category */}
                        {activeCategory === CUSTOM_SVG_CATEGORY && customSvgs.length === 0 && (
                            <div className='ChannelIconSelector__emptyCustom'>
                                <i className='icon icon-vector-square'/>
                                <p>{formatMessage({id: 'channel_icon_selector.no_custom_svgs', defaultMessage: 'No custom SVGs yet'})}</p>
                                <span>{formatMessage({id: 'channel_icon_selector.add_svg_description', defaultMessage: 'Add your own SVG icons to use as channel icons'})}</span>
                                <button
                                    type='button'
                                    className='ChannelIconSelector__addCustomSvgButton'
                                    onClick={handleAddCustomSvg}
                                >
                                    <i className='icon icon-plus'/>
                                    {formatMessage({id: 'channel_icon_selector.add_svg_button', defaultMessage: 'Add Custom SVG'})}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Hide custom icon name input when viewing Custom SVG category */}
                    {activeCategory !== CUSTOM_SVG_CATEGORY && (
                        <div className='ChannelIconSelector__customInput'>
                            <label>
                                {formatMessage({id: 'channel_icon_selector.custom', defaultMessage: 'Custom icon name:'})}
                            </label>
                            <div className='ChannelIconSelector__customInputRow'>
                                <input
                                    type='text'
                                    placeholder={formatMessage({id: 'channel_icon_selector.custom_placeholder', defaultMessage: 'e.g., rocket, trophy, etc.'})}
                                    value={selectedIcon && !ALL_ICONS.includes(selectedIcon) && !selectedCustomSvg ? selectedIcon : ''}
                                    onChange={(e) => onSelectIcon(e.target.value.trim())}
                                />
                                {selectedIcon && !ALL_ICONS.includes(selectedIcon) && !selectedCustomSvg && (
                                    <i className={`icon icon-${selectedIcon} ChannelIconSelector__customPreview`}/>
                                )}
                            </div>
                            <span className='ChannelIconSelector__customHint'>
                                {formatMessage({
                                    id: 'channel_icon_selector.custom_hint',
                                    defaultMessage: 'Enter any compass-icons name. See all icons at materialdesignicons.com',
                                })}
                            </span>
                        </div>
                    )}
                </div>
            )}

            <CustomSvgModal
                show={showCustomSvgModal}
                onClose={() => {
                    setShowCustomSvgModal(false);
                    setEditingCustomSvg(undefined);
                }}
                onSave={handleSaveCustomSvg}
                editingSvg={editingCustomSvg}
            />
        </div>
    );
}
