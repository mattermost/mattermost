// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';

import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {
    mdiLibrary,
    lucideLibrary,
    getMdiIconPath,
    getLucideIconPaths,
    parseIconValue,
    formatIconValue,
    type IconLibrary,
    type IconFormat,
} from './icon_libraries';

import './channel_settings_icon_tab.scss';

type LibraryTab = 'mdi' | 'lucide' | 'custom';

type Props = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
};

// Component to render MDI icons (filled path)
function MdiIcon({name, size = 20}: {name: string; size?: number}) {
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
function LucideIcon({name, size = 20}: {name: string; size?: number}) {
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

// Component to render custom SVG from base64
function CustomSvgIcon({base64, size = 20}: {base64: string; size?: number}) {
    try {
        const svgContent = atob(base64);
        // Sanitize: remove script tags and event handlers
        const sanitized = svgContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '');

        return (
            <span
                className='ChannelSettingsIconTab__customSvgIcon'
                style={{width: size, height: size}}
                dangerouslySetInnerHTML={{__html: sanitized}}
            />
        );
    } catch {
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
    const [customSvgInput, setCustomSvgInput] = useState('');
    const [customSvgError, setCustomSvgError] = useState('');

    // Save state
    const [formError, setFormError] = useState('');
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    // Get the current library
    const currentLibrary: IconLibrary | null = activeLibrary === 'mdi' ? mdiLibrary : activeLibrary === 'lucide' ? lucideLibrary : null;

    // Filter icons based on search
    const filteredIcons = useMemo(() => {
        if (!currentLibrary) {
            return [];
        }

        const term = searchTerm.toLowerCase().trim();
        let icons = currentLibrary.categories.flatMap((cat) => {
            if (activeCategory && cat.id !== activeCategory) {
                return [];
            }
            return cat.icons.map((icon) => ({
                ...icon,
                category: cat.id,
            }));
        });

        if (term) {
            icons = icons.filter((icon) =>
                icon.name.toLowerCase().includes(term) ||
                icon.aliases?.some((a) => a.toLowerCase().includes(term)),
            );
        }

        return icons;
    }, [currentLibrary, searchTerm, activeCategory]);

    // Track unsaved changes
    useEffect(() => {
        const originalIcon = channel.props?.custom_icon || '';
        const hasChanges = customIcon !== originalIcon;
        setAreThereUnsavedChanges?.(hasChanges);
    }, [channel, customIcon, setAreThereUnsavedChanges]);

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

    // Validate and apply custom SVG
    const handleApplyCustomSvg = useCallback(() => {
        const svgContent = customSvgInput.trim();
        if (!svgContent) {
            setCustomSvgError(formatMessage({
                id: 'channel_settings_icon_tab.custom_svg.empty',
                defaultMessage: 'Please enter SVG content',
            }));
            return;
        }

        // Basic SVG validation
        if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
            setCustomSvgError(formatMessage({
                id: 'channel_settings_icon_tab.custom_svg.invalid',
                defaultMessage: 'Invalid SVG format. Must contain <svg> tags.',
            }));
            return;
        }

        // Check size limit (10KB base64)
        const base64 = btoa(svgContent);
        if (base64.length > 10240) {
            setCustomSvgError(formatMessage({
                id: 'channel_settings_icon_tab.custom_svg.too_large',
                defaultMessage: 'SVG is too large. Maximum size is 10KB.',
            }));
            return;
        }

        setCustomSvgError('');
        handleIconSelect('svg', base64);
        setCustomSvgInput('');
    }, [customSvgInput, formatMessage, handleIconSelect]);

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

    const libraryTabs: {id: LibraryTab; label: string}[] = [
        {id: 'mdi', label: formatMessage({id: 'channel_settings_icon_tab.library.mdi', defaultMessage: 'Material Design'})},
        {id: 'lucide', label: formatMessage({id: 'channel_settings_icon_tab.library.lucide', defaultMessage: 'Lucide'})},
        {id: 'custom', label: formatMessage({id: 'channel_settings_icon_tab.library.custom', defaultMessage: 'Custom SVG'})},
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
                        {customIcon ? parseIconValue(customIcon).name : formatMessage({
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
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Library content */}
            {currentLibrary && (
                <div className='ChannelSettingsIconTab__libraryContent'>
                    {/* Search */}
                    <div className='ChannelSettingsIconTab__search'>
                        <i className='icon icon-magnify'/>
                        <input
                            type='text'
                            placeholder={formatMessage({
                                id: 'channel_settings_icon_tab.search',
                                defaultMessage: 'Search icons...',
                            })}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setActiveCategory(null);
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

                    {/* Categories */}
                    {!searchTerm && (
                        <div className='ChannelSettingsIconTab__categories'>
                            <button
                                type='button'
                                className={`ChannelSettingsIconTab__categoryButton ${activeCategory === null ? 'active' : ''}`}
                                onClick={() => setActiveCategory(null)}
                            >
                                {formatMessage({id: 'channel_settings_icon_tab.all', defaultMessage: 'All'})}
                            </button>
                            {currentLibrary.categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type='button'
                                    className={`ChannelSettingsIconTab__categoryButton ${activeCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Icons grid */}
                    <div className='ChannelSettingsIconTab__iconsGrid'>
                        {filteredIcons.length === 0 ? (
                            <div className='ChannelSettingsIconTab__noResults'>
                                {formatMessage({
                                    id: 'channel_settings_icon_tab.no_results',
                                    defaultMessage: 'No icons found',
                                })}
                            </div>
                        ) : (
                            filteredIcons.map((icon) => {
                                const iconValue = formatIconValue(currentLibrary.id, icon.name);
                                const isSelected = customIcon === iconValue;
                                return (
                                    <button
                                        key={icon.name}
                                        type='button'
                                        className={`ChannelSettingsIconTab__iconButton ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleIconSelect(currentLibrary.id, icon.name)}
                                        title={icon.name}
                                        aria-label={icon.name}
                                    >
                                        {currentLibrary.id === 'mdi' ? (
                                            <MdiIcon name={icon.name}/>
                                        ) : (
                                            <LucideIcon name={icon.name}/>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Custom SVG tab content */}
            {activeLibrary === 'custom' && (
                <div className='ChannelSettingsIconTab__customContent'>
                    <div className='ChannelSettingsIconTab__customDescription'>
                        {formatMessage({
                            id: 'channel_settings_icon_tab.custom_description',
                            defaultMessage: 'Paste your SVG code below. The SVG will be sanitized for security.',
                        })}
                    </div>
                    <textarea
                        className='ChannelSettingsIconTab__customTextarea'
                        placeholder={formatMessage({
                            id: 'channel_settings_icon_tab.custom_placeholder',
                            defaultMessage: '<svg viewBox="0 0 24 24">...</svg>',
                        })}
                        value={customSvgInput}
                        onChange={(e) => {
                            setCustomSvgInput(e.target.value);
                            setCustomSvgError('');
                        }}
                        rows={6}
                    />
                    {customSvgError && (
                        <div className='ChannelSettingsIconTab__customError'>
                            {customSvgError}
                        </div>
                    )}
                    {customSvgInput && (
                        <div className='ChannelSettingsIconTab__customPreview'>
                            <span className='ChannelSettingsIconTab__customPreviewLabel'>
                                {formatMessage({id: 'channel_settings_icon_tab.preview', defaultMessage: 'Preview:'})}
                            </span>
                            <span
                                className='ChannelSettingsIconTab__customPreviewIcon'
                                dangerouslySetInnerHTML={{__html: customSvgInput}}
                            />
                        </div>
                    )}
                    <button
                        type='button'
                        className='ChannelSettingsIconTab__customApplyButton btn btn-primary'
                        onClick={handleApplyCustomSvg}
                        disabled={!customSvgInput.trim()}
                    >
                        {formatMessage({id: 'channel_settings_icon_tab.apply', defaultMessage: 'Apply Icon'})}
                    </button>
                </div>
            )}

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
export {MdiIcon, LucideIcon, CustomSvgIcon, IconPreview};
