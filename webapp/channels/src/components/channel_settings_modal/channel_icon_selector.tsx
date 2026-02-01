// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';

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

type Props = {
    selectedIcon: string;
    onSelectIcon: (icon: string) => void;
    disabled?: boolean;
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

    const filteredIcons = useMemo(() => {
        if (!searchTerm.trim()) {
            if (activeCategory) {
                return CHANNEL_ICONS[activeCategory] || [];
            }
            return ALL_ICONS;
        }
        const term = searchTerm.toLowerCase();
        return ALL_ICONS.filter((icon) => icon.toLowerCase().includes(term));
    }, [searchTerm, activeCategory]);

    const handleIconClick = useCallback((icon: string) => {
        onSelectIcon(icon === selectedIcon ? '' : icon);
        setIsOpen(false);
        setSearchTerm('');
        setActiveCategory(null);
    }, [selectedIcon, onSelectIcon]);

    const handleClearIcon = useCallback(() => {
        onSelectIcon('');
    }, [onSelectIcon]);

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
                    {selectedIcon ? (
                        <i className={`icon icon-${selectedIcon}`}/>
                    ) : (
                        <i className='icon icon-globe'/>
                    )}
                    <span className='ChannelIconSelector__previewLabel'>
                        {selectedIcon || formatMessage({id: 'channel_icon_selector.default', defaultMessage: 'Default'})}
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
                        </div>
                    )}

                    <div className='ChannelIconSelector__icons'>
                        {filteredIcons.length === 0 ? (
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
                    </div>
                </div>
            )}
        </div>
    );
}
