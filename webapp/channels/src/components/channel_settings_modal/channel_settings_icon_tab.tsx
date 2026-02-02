// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';

import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {
    iconLibraries,
    searchAllLibraries,
    getMatchingCategories,
    getSearchFieldLabel,
    getMdiIconPath,
    getLucideIconPaths,
    getTablerIconPaths,
    getFeatherIconSvg,
    getSimpleIconPath,
    getFontAwesomeIconPath,
    parseIconValue,
    formatIconValue,
    getTotalIconCount,
    getCustomSvgsFromServer,
    addCustomSvgToServer,
    updateCustomSvgOnServer,
    deleteCustomSvgFromServer,
    decodeSvgFromBase64,
    sanitizeSvg,
    normalizeSvgColors,
    encodeSvgToBase64,
    type CustomSvg,
    type IconLibrary,
    type IconLibraryId,
    type IconFormat,
    type SearchField,
    type SearchResult,
} from './icon_libraries';
import CustomSvgModal from './custom_svg_modal';

import './channel_settings_icon_tab.scss';

type LibraryTab = IconLibraryId | 'all' | 'custom';

type Props = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
};

// Component to render MDI icons (filled path)
function MdiIcon({name, size = 22}: {name: string; size?: number}) {
    const path = getMdiIconPath(name);
    if (!path) {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
    return (
        <svg
            viewBox='0 0 24 24'
            width={size}
            height={size}
            fill='currentColor'
        >
            <path d={path}/>
        </svg>
    );
}

// Component to render Lucide icons (stroke-based)
function LucideIcon({name, size = 22}: {name: string; size?: number}) {
    const paths = getLucideIconPaths(name);
    if (!paths) {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
    return (
        <svg
            viewBox='0 0 24 24'
            width={size}
            height={size}
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            {paths.map((d, i) => (
                <path
                    key={i}
                    d={d}
                />
            ))}
        </svg>
    );
}

// Component to render Tabler icons (stroke-based, similar to Lucide)
function TablerIcon({name, size = 22}: {name: string; size?: number}) {
    const paths = getTablerIconPaths(name);
    if (!paths) {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
    return (
        <svg
            viewBox='0 0 24 24'
            width={size}
            height={size}
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            {paths.map((d, i) => (
                <path
                    key={i}
                    d={d}
                />
            ))}
        </svg>
    );
}

// Component to render Feather icons (SVG content string)
function FeatherIcon({name, size = 22}: {name: string; size?: number}) {
    const svgContent = getFeatherIconSvg(name);
    if (!svgContent) {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
    return (
        <svg
            viewBox='0 0 24 24'
            width={size}
            height={size}
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            dangerouslySetInnerHTML={{__html: svgContent}}
        />
    );
}

// Component to render Simple (brand) icons (filled path)
function SimpleIcon({name, size = 22}: {name: string; size?: number}) {
    const path = getSimpleIconPath(name);
    if (!path) {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
    return (
        <svg
            viewBox='0 0 24 24'
            width={size}
            height={size}
            fill='currentColor'
        >
            <path d={path}/>
        </svg>
    );
}

// Component to render Font Awesome icons (filled path, 512x512 viewBox)
function FontAwesomeIcon({name, size = 22}: {name: string; size?: number}) {
    const path = getFontAwesomeIconPath(name);
    if (!path) {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
    return (
        <svg
            viewBox='0 0 512 512'
            width={size}
            height={size}
            fill='currentColor'
        >
            <path d={path}/>
        </svg>
    );
}

// Component to render custom SVG from base64
function CustomSvgIcon({base64, size = 22}: {base64: string; size?: number}) {
    try {
        let svgContent = atob(base64);

        // Sanitize: remove script tags and event handlers
        svgContent = svgContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '');

        // Normalize colors: remove fill/stroke attributes to inherit from CSS
        svgContent = svgContent
            .replace(/\sfill=["'][^"']*["']/gi, ' fill="currentColor"')
            .replace(/\sstroke=["'][^"']*["']/gi, '');

        return (
            <span
                className='ChannelSettingsIconTab__customSvgIcon'
                style={{width: size, height: size}}
                dangerouslySetInnerHTML={{__html: svgContent}}
            />
        );
    } catch {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
}

// Component to render custom SVG from storage (CustomSvg object)
function CustomSvgIconFromStorage({svg, size = 22}: {svg: CustomSvg; size?: number}) {
    try {
        let svgContent = decodeSvgFromBase64(svg.svg);
        svgContent = sanitizeSvg(svgContent);
        if (svg.normalizeColor) {
            svgContent = normalizeSvgColors(svgContent);
        }

        // Add size to SVG
        svgContent = svgContent.replace(/<svg/, `<svg width="${size}" height="${size}"`);

        return (
            <span
                className='ChannelSettingsIconTab__customSvgIcon'
                dangerouslySetInnerHTML={{__html: svgContent}}
            />
        );
    } catch {
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
}

// Render icon based on library type
function LibraryIcon({library, name, size = 22}: {library: IconLibraryId; name: string; size?: number}) {
    switch (library) {
    case 'mdi':
        return <MdiIcon name={name} size={size}/>;
    case 'lucide':
        return <LucideIcon name={name} size={size}/>;
    case 'tabler':
        return <TablerIcon name={name} size={size}/>;
    case 'feather':
        return <FeatherIcon name={name} size={size}/>;
    case 'fontawesome':
        return <FontAwesomeIcon name={name} size={size}/>;
    case 'simple':
        return <SimpleIcon name={name} size={size}/>;
    default:
        return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
    }
}

// Unified icon preview component
function IconPreview({value, size = 24}: {value: string; size?: number}) {
    const {format, name} = parseIconValue(value);

    if (format === 'none' || !name) {
        return (
            <span className='ChannelSettingsIconTab__defaultIcon'>
                <i className='icon icon-globe'/>
            </span>
        );
    }

    if (format === 'mdi') {
        return <MdiIcon name={name} size={size}/>;
    }

    if (format === 'lucide') {
        return <LucideIcon name={name} size={size}/>;
    }

    if (format === 'tabler') {
        return <TablerIcon name={name} size={size}/>;
    }

    if (format === 'feather') {
        return <FeatherIcon name={name} size={size}/>;
    }

    if (format === 'simple') {
        return <SimpleIcon name={name} size={size}/>;
    }

    if (format === 'fontawesome') {
        return <FontAwesomeIcon name={name} size={size}/>;
    }

    if (format === 'svg') {
        return <CustomSvgIcon base64={name} size={size}/>;
    }

    return <span className='ChannelSettingsIconTab__unknownIcon'>?</span>;
}

export default function ChannelSettingsIconTab({
    channel,
    setAreThereUnsavedChanges,
    showTabSwitchError,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // Current icon value (with prefix)
    const [customIcon, setCustomIcon] = useState(channel.props?.custom_icon || '');

    // UI state
    const [activeLibrary, setActiveLibrary] = useState<LibraryTab>('mdi');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Custom SVG state
    const [customSvgs, setCustomSvgs] = useState<CustomSvg[]>([]);
    const [showCustomSvgModal, setShowCustomSvgModal] = useState(false);
    const [editingCustomSvg, setEditingCustomSvg] = useState<CustomSvg | undefined>(undefined);

    // Search options
    const [searchFields, setSearchFields] = useState<SearchField[]>(['name', 'tags', 'aliases']);

    // Save state
    const [formError, setFormError] = useState('');
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    // Get the current library (null for 'all' and 'custom')
    const currentLibrary: IconLibrary | null = useMemo(() => {
        if (activeLibrary === 'all' || activeLibrary === 'custom') {
            return null;
        }
        return iconLibraries.find((lib) => lib.id === activeLibrary) || null;
    }, [activeLibrary]);

    // Get matching categories for highlighting
    const matchingCategories = useMemo(() => {
        if (!currentLibrary || !searchTerm.trim()) {
            return [];
        }
        return getMatchingCategories(currentLibrary, searchTerm);
    }, [currentLibrary, searchTerm]);

    // Search results for "All" tab or when searching within a library
    const searchResults = useMemo((): SearchResult[] => {
        if (!searchTerm.trim()) {
            return [];
        }

        if (activeLibrary === 'all') {
            return searchAllLibraries(searchTerm, {fields: searchFields, limit: 150});
        }

        if (currentLibrary) {
            return currentLibrary.search(searchTerm, {fields: searchFields, limit: 150});
        }

        return [];
    }, [searchTerm, activeLibrary, currentLibrary, searchFields]);

    // Icons to display (either from category or search)
    const displayIcons = useMemo(() => {
        // If searching, show search results
        if (searchTerm.trim()) {
            return searchResults;
        }

        // For "All" tab without search, show nothing (too many icons)
        if (activeLibrary === 'all') {
            return [];
        }

        // For library tab, show category icons
        if (currentLibrary) {
            if (activeCategory) {
                const category = currentLibrary.categories.find((c) => c.id === activeCategory);
                if (category) {
                    return category.iconNames.map((name) => ({
                        library: currentLibrary.id,
                        name,
                        matchedField: 'name' as SearchField,
                        matchedValue: name,
                    }));
                }
            }

            // Show all icons from all categories (limited)
            const allIcons: SearchResult[] = [];
            for (const category of currentLibrary.categories) {
                for (const name of category.iconNames) {
                    if (allIcons.length >= 200) {
                        break;
                    }
                    if (!allIcons.some((i) => i.name === name)) {
                        allIcons.push({
                            library: currentLibrary.id,
                            name,
                            matchedField: 'name',
                            matchedValue: name,
                        });
                    }
                }
            }
            return allIcons;
        }

        return [];
    }, [searchTerm, searchResults, activeLibrary, currentLibrary, activeCategory]);

    // Track unsaved changes
    useEffect(() => {
        const originalIcon = channel.props?.custom_icon || '';
        const hasChanges = customIcon !== originalIcon;
        setAreThereUnsavedChanges?.(hasChanges);
    }, [channel, customIcon, setAreThereUnsavedChanges]);

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

    // Handle icon selection
    const handleIconSelect = useCallback((format: IconFormat, name: string) => {
        const value = formatIconValue(format, name);
        setCustomIcon(value);
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, []);

    // Handle clear icon
    const handleClearIcon = useCallback(() => {
        setCustomIcon('');
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, []);

    // Toggle search field
    const toggleSearchField = useCallback((field: SearchField) => {
        setSearchFields((prev) => {
            if (prev.includes(field)) {
                // Don't allow removing all fields
                if (prev.length === 1) {
                    return prev;
                }
                return prev.filter((f) => f !== field);
            }
            return [...prev, field];
        });
    }, []);

    // Custom SVG modal handlers
    const handleAddCustomSvg = useCallback(() => {
        setEditingCustomSvg(undefined);
        setShowCustomSvgModal(true);
    }, []);

    const handleEditCustomSvg = useCallback((svg: CustomSvg) => {
        setEditingCustomSvg(svg);
        setShowCustomSvgModal(true);
    }, []);

    const handleDeleteCustomSvg = useCallback(async (svg: CustomSvg) => {
        if (window.confirm(formatMessage({id: 'channel_settings_icon_tab.confirm_delete', defaultMessage: 'Delete "{name}"?'}, {name: svg.name}))) {
            try {
                await deleteCustomSvgFromServer(svg.id);
                await refreshCustomSvgs();

                // Clear selection if the deleted SVG was selected
                const currentParsed = parseIconValue(customIcon);
                if (currentParsed.format === 'svg') {
                    // Check if the current icon matches this SVG
                    let processedSvg = decodeSvgFromBase64(svg.svg);
                    processedSvg = sanitizeSvg(processedSvg);
                    if (svg.normalizeColor) {
                        processedSvg = normalizeSvgColors(processedSvg);
                    }
                    const processedBase64 = encodeSvgToBase64(processedSvg);
                    if (currentParsed.name === processedBase64) {
                        handleClearIcon();
                    }
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to delete custom SVG:', error);
            }
        }
    }, [formatMessage, refreshCustomSvgs, customIcon, handleClearIcon]);

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
                handleIconSelect('svg', base64);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to save custom SVG:', error);
        }
    }, [editingCustomSvg, refreshCustomSvgs, handleIconSelect]);

    const handleSelectCustomSvg = useCallback((svg: CustomSvg) => {
        // Process the SVG and store as svg:base64 format for portability
        let processedSvg = decodeSvgFromBase64(svg.svg);
        processedSvg = sanitizeSvg(processedSvg);
        if (svg.normalizeColor) {
            processedSvg = normalizeSvgColors(processedSvg);
        }
        const base64 = encodeSvgToBase64(processedSvg);
        handleIconSelect('svg', base64);
    }, [handleIconSelect]);

    // Check if a custom SVG is currently selected
    const getSelectedCustomSvgId = useCallback(() => {
        const parsed = parseIconValue(customIcon);
        if (parsed.format === 'svg' && parsed.name) {
            // Try to find a matching custom SVG by comparing base64 content
            const matchingSvg = customSvgs.find((svg) => {
                let processedSvg = decodeSvgFromBase64(svg.svg);
                processedSvg = sanitizeSvg(processedSvg);
                if (svg.normalizeColor) {
                    processedSvg = normalizeSvgColors(processedSvg);
                }
                const processedBase64 = encodeSvgToBase64(processedSvg);
                return processedBase64 === parsed.name;
            });
            return matchingSvg?.id;
        }
        return undefined;
    }, [customIcon, customSvgs]);

    const selectedCustomSvgId = getSelectedCustomSvgId();

    // Get display name for current icon (custom SVG name if available, otherwise parsed name)
    const getIconDisplayName = useCallback(() => {
        if (!customIcon) {
            return null;
        }

        const parsed = parseIconValue(customIcon);

        // If it's a custom SVG, try to find the name from our saved SVGs
        if (parsed.format === 'svg' && parsed.name) {
            const matchingSvg = customSvgs.find((svg) => {
                let processedSvg = decodeSvgFromBase64(svg.svg);
                processedSvg = sanitizeSvg(processedSvg);
                if (svg.normalizeColor) {
                    processedSvg = normalizeSvgColors(processedSvg);
                }
                const processedBase64 = encodeSvgToBase64(processedSvg);
                return processedBase64 === parsed.name;
            });

            if (matchingSvg) {
                return matchingSvg.name;
            }

            // No matching saved SVG, show truncated base64 to indicate it's a custom SVG
            const truncated = parsed.name.length > 20 ? parsed.name.substring(0, 20) + '...' : parsed.name;
            return `svg:${truncated}`;
        }

        // For library icons, show format:name
        return `${parsed.format}:${parsed.name}`;
    }, [customIcon, customSvgs]);

    // Handle save
    const handleSave = useCallback(async (): Promise<boolean> => {
        const updated: Channel = {
            ...channel,
            props: {
                ...channel.props,
                custom_icon: customIcon,
            },
        };

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            const errorMsg = (error as ServerError).message || formatMessage({
                id: 'channel_settings.unknown_error',
                defaultMessage: 'Something went wrong.',
            });
            setFormError(errorMsg);
            return false;
        }

        return true;
    }, [channel, customIcon, dispatch, formatMessage]);

    const handleSaveChanges = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
    }, [handleSave]);

    const handleCancel = useCallback(() => {
        setCustomIcon(channel.props?.custom_icon || '');
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, [channel]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
    }, []);

    // Check if should show save panel
    const shouldShowPanel = useMemo(() => {
        const originalIcon = channel.props?.custom_icon || '';
        const hasChanges = customIcon !== originalIcon;
        return hasChanges || saveChangesPanelState === 'saved';
    }, [channel, customIcon, saveChangesPanelState]);

    const hasErrors = Boolean(formError) || Boolean(showTabSwitchError);

    // Example icons for each library (showing a recognizable icon from each to show aesthetic)
    // Note: icon names vary by library (e.g., Lucide/FA use "house", others use "home")
    const libraryExampleIcons: Record<string, {library: IconLibraryId; name: string} | null> = {
        'all': null, // No example for "All" tab
        'mdi': {library: 'mdi', name: 'home'},
        'lucide': {library: 'lucide', name: 'house'},
        'tabler': {library: 'tabler', name: 'home'},
        'feather': {library: 'feather', name: 'home'},
        'fontawesome': {library: 'fontawesome', name: 'house'},
        'simple': {library: 'simple', name: 'github'},
        'custom': null, // No example for "Custom SVG" tab
    };

    // Library tabs with counts
    const libraryTabs: {id: LibraryTab; label: string; count: number; exampleIcon: {library: IconLibraryId; name: string} | null}[] = [
        {
            id: 'all',
            label: formatMessage({id: 'channel_settings_icon_tab.library.all', defaultMessage: 'All'}),
            count: getTotalIconCount(),
            exampleIcon: null,
        },
        ...iconLibraries.map((lib) => ({
            id: lib.id as LibraryTab,
            label: lib.name,
            count: lib.iconCount,
            exampleIcon: libraryExampleIcons[lib.id] || null,
        })),
        {
            id: 'custom',
            label: formatMessage({id: 'channel_settings_icon_tab.library.custom', defaultMessage: 'Custom SVG'}),
            count: customSvgs.length,
            exampleIcon: null,
        },
    ];

    return (
        <div className='ChannelSettingsIconTab'>
            <div className='ChannelSettingsIconTab__header'>
                <div className='ChannelSettingsIconTab__title'>
                    {formatMessage({id: 'channel_settings_icon_tab.title', defaultMessage: 'Channel Icon'})}
                </div>
                <div className='ChannelSettingsIconTab__description'>
                    {formatMessage({
                        id: 'channel_settings_icon_tab.description',
                        defaultMessage: 'Choose an icon to display next to this channel in the sidebar.',
                    })}
                </div>
            </div>

            {/* Current icon preview */}
            <div className='ChannelSettingsIconTab__preview'>
                <div className='ChannelSettingsIconTab__previewIcon'>
                    <IconPreview value={customIcon} size={32}/>
                </div>
                <div className='ChannelSettingsIconTab__previewInfo'>
                    <div className='ChannelSettingsIconTab__previewLabel'>
                        {customIcon ? getIconDisplayName() : formatMessage({
                            id: 'channel_settings_icon_tab.default',
                            defaultMessage: 'Default',
                        })}
                    </div>
                    {customIcon && (
                        <button
                            type='button'
                            className='ChannelSettingsIconTab__clearButton'
                            onClick={handleClearIcon}
                        >
                            {formatMessage({id: 'channel_settings_icon_tab.clear', defaultMessage: 'Clear'})}
                        </button>
                    )}
                </div>
            </div>

            {/* Library tabs */}
            <div className='ChannelSettingsIconTab__libraryTabs'>
                {libraryTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type='button'
                        className={`ChannelSettingsIconTab__libraryTab ${activeLibrary === tab.id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveLibrary(tab.id);
                            setSearchTerm('');
                            setActiveCategory(null);
                        }}
                    >
                        {tab.exampleIcon && (
                            <span className='ChannelSettingsIconTab__libraryTab__icon'>
                                <LibraryIcon
                                    library={tab.exampleIcon.library}
                                    name={tab.exampleIcon.name}
                                    size={14}
                                />
                            </span>
                        )}
                        {tab.label}
                        {tab.count > 0 && (
                            <span className='ChannelSettingsIconTab__libraryTab__count'>
                                ({tab.count.toLocaleString()})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Library content (All tab and specific libraries) */}
            {activeLibrary !== 'custom' && (
                <div className='ChannelSettingsIconTab__libraryContent'>
                    {/* Sticky search area */}
                    <div className='ChannelSettingsIconTab__searchArea'>
                        <div className='ChannelSettingsIconTab__search'>
                            <i className='icon icon-magnify'/>
                            <input
                                type='text'
                                placeholder={
                                    activeLibrary === 'all'
                                        ? formatMessage({id: 'channel_settings_icon_tab.search_all', defaultMessage: 'Search all icons...'})
                                        : formatMessage({id: 'channel_settings_icon_tab.search', defaultMessage: 'Search icons...'})
                                }
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (e.target.value.trim()) {
                                        setActiveCategory(null);
                                    }
                                }}
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

                        {/* Search options */}
                        <div className='ChannelSettingsIconTab__searchOptions'>
                            <span>{formatMessage({id: 'channel_settings_icon_tab.search_by', defaultMessage: 'Search by:'})}</span>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={searchFields.includes('name')}
                                    onChange={() => toggleSearchField('name')}
                                />
                                {formatMessage({id: 'channel_settings_icon_tab.search_name', defaultMessage: 'Name'})}
                            </label>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={searchFields.includes('tags')}
                                    onChange={() => toggleSearchField('tags')}
                                />
                                {formatMessage({id: 'channel_settings_icon_tab.search_tags', defaultMessage: 'Tags'})}
                            </label>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={searchFields.includes('aliases')}
                                    onChange={() => toggleSearchField('aliases')}
                                />
                                {formatMessage({id: 'channel_settings_icon_tab.search_aliases', defaultMessage: 'Aliases'})}
                            </label>
                        </div>

                        {activeLibrary === 'all' && !searchTerm && (
                            <div className='ChannelSettingsIconTab__searchHint'>
                                {formatMessage({
                                    id: 'channel_settings_icon_tab.all_hint',
                                    defaultMessage: 'Type to search across all icon libraries',
                                })}
                            </div>
                        )}
                    </div>

                    {/* Category filter buttons */}
                    {currentLibrary && !searchTerm && (
                        <div className='ChannelSettingsIconTab__categories'>
                            <button
                                type='button'
                                className={`ChannelSettingsIconTab__categoryButton ${activeCategory === null ? 'active' : ''}`}
                                onClick={() => setActiveCategory(null)}
                            >
                                {formatMessage({id: 'channel_settings_icon_tab.all_category', defaultMessage: 'All'})}
                                <span className='ChannelSettingsIconTab__categoryButton__count'>
                                    ({currentLibrary.iconCount.toLocaleString()})
                                </span>
                            </button>
                            {currentLibrary.categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type='button'
                                    className={`ChannelSettingsIconTab__categoryButton ${activeCategory === cat.id ? 'active' : ''} ${matchingCategories.includes(cat.id) ? 'highlighted' : ''}`}
                                    onClick={() => setActiveCategory(cat.id)}
                                >
                                    {cat.name}
                                    <span className='ChannelSettingsIconTab__categoryButton__count'>
                                        ({cat.iconNames.length})
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Result info when searching */}
                    {searchTerm && searchResults.length > 0 && (
                        <div className='ChannelSettingsIconTab__resultInfo'>
                            {formatMessage(
                                {id: 'channel_settings_icon_tab.results_count', defaultMessage: 'Found {count} icons'},
                                {count: <strong>{searchResults.length}</strong>},
                            )}
                        </div>
                    )}

                    {/* Icons grid */}
                    <div className='ChannelSettingsIconTab__iconsContainer'>
                        <div className='ChannelSettingsIconTab__iconsGrid'>
                            {displayIcons.length === 0 && searchTerm ? (
                                <div className='ChannelSettingsIconTab__noResults'>
                                    {formatMessage({
                                        id: 'channel_settings_icon_tab.no_results',
                                        defaultMessage: 'No icons found',
                                    })}
                                </div>
                            ) : displayIcons.length === 0 && activeLibrary === 'all' ? (
                                <div className='ChannelSettingsIconTab__noResults'>
                                    {formatMessage({
                                        id: 'channel_settings_icon_tab.type_to_search',
                                        defaultMessage: 'Type above to search icons',
                                    })}
                                </div>
                            ) : (
                                displayIcons.map((result) => {
                                    const iconValue = formatIconValue(result.library, result.name);
                                    const isSelected = customIcon === iconValue;
                                    return (
                                        <button
                                            key={`${result.library}-${result.name}`}
                                            type='button'
                                            className={`ChannelSettingsIconTab__iconButton ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleIconSelect(result.library, result.name)}
                                            title={`${result.name}${result.matchedField !== 'name' && searchTerm ? ` (${getSearchFieldLabel(result.matchedField)}: ${result.matchedValue})` : ''}`}
                                            aria-label={result.name}
                                        >
                                            <LibraryIcon
                                                library={result.library}
                                                name={result.name}
                                            />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Custom SVG tab content */}
            {activeLibrary === 'custom' && (
                <div className='ChannelSettingsIconTab__customContent'>
                    {customSvgs.length > 0 ? (
                        <>
                            <div className='ChannelSettingsIconTab__customDescription'>
                                {formatMessage({
                                    id: 'channel_settings_icon_tab.custom_description_new',
                                    defaultMessage: 'Select from your saved custom SVGs or add a new one.',
                                })}
                            </div>
                            <div className='ChannelSettingsIconTab__customSvgGrid'>
                                {customSvgs.map((svg) => {
                                    const isSelected = selectedCustomSvgId === svg.id;
                                    return (
                                        <div
                                            key={svg.id}
                                            className={`ChannelSettingsIconTab__customSvgItem ${isSelected ? 'selected' : ''}`}
                                        >
                                            <button
                                                type='button'
                                                className='ChannelSettingsIconTab__customSvgButton'
                                                onClick={() => handleSelectCustomSvg(svg)}
                                                title={svg.name}
                                                aria-label={svg.name}
                                            >
                                                <CustomSvgIconFromStorage svg={svg} size={28}/>
                                            </button>
                                            <div className='ChannelSettingsIconTab__customSvgName'>
                                                {svg.name}
                                            </div>
                                            <div className='ChannelSettingsIconTab__customSvgActions'>
                                                <button
                                                    type='button'
                                                    className='ChannelSettingsIconTab__customSvgAction'
                                                    onClick={() => handleEditCustomSvg(svg)}
                                                    title={formatMessage({id: 'channel_settings_icon_tab.edit', defaultMessage: 'Edit'})}
                                                >
                                                    <i className='icon icon-pencil-outline'/>
                                                </button>
                                                <button
                                                    type='button'
                                                    className='ChannelSettingsIconTab__customSvgAction ChannelSettingsIconTab__customSvgAction--delete'
                                                    onClick={() => handleDeleteCustomSvg(svg)}
                                                    title={formatMessage({id: 'channel_settings_icon_tab.delete', defaultMessage: 'Delete'})}
                                                >
                                                    <i className='icon icon-trash-can-outline'/>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Add new SVG button in grid */}
                                <button
                                    type='button'
                                    className='ChannelSettingsIconTab__addCustomSvgInGrid'
                                    onClick={handleAddCustomSvg}
                                    title={formatMessage({id: 'channel_settings_icon_tab.add_custom_svg', defaultMessage: 'Add custom SVG'})}
                                >
                                    <i className='icon icon-plus'/>
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className='ChannelSettingsIconTab__customEmptyState'>
                            <i className='icon icon-vector-square'/>
                            <p>{formatMessage({id: 'channel_settings_icon_tab.no_custom_svgs', defaultMessage: 'No custom SVGs yet'})}</p>
                            <span>{formatMessage({id: 'channel_settings_icon_tab.add_svg_description', defaultMessage: 'Add your own SVG icons to use as channel icons'})}</span>
                            <button
                                type='button'
                                className='ChannelSettingsIconTab__addCustomSvgButton btn btn-primary'
                                onClick={handleAddCustomSvg}
                            >
                                <i className='icon icon-plus'/>
                                {formatMessage({id: 'channel_settings_icon_tab.add_custom_svg', defaultMessage: 'Add Custom SVG'})}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Custom SVG Modal */}
            <CustomSvgModal
                show={showCustomSvgModal}
                onClose={() => {
                    setShowCustomSvgModal(false);
                    setEditingCustomSvg(undefined);
                }}
                onSave={handleSaveCustomSvg}
                editingSvg={editingCustomSvg}
            />

            {/* Save changes panel */}
            {shouldShowPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? 'error' : saveChangesPanelState}
                    {...(!showTabSwitchError && {
                        customErrorMessage: formatMessage({
                            id: 'channel_settings.save_changes_panel.standard_error',
                            defaultMessage: 'There are errors in the form above',
                        }),
                    })}
                    cancelButtonText={formatMessage({
                        id: 'channel_settings.save_changes_panel.reset',
                        defaultMessage: 'Reset',
                    })}
                />
            )}
        </div>
    );
}

// Export icon components for use in sidebar
export {MdiIcon, LucideIcon, TablerIcon, FeatherIcon, SimpleIcon, FontAwesomeIcon, CustomSvgIcon, IconPreview};
