// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import * as Emoji from 'utils/emoji.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import * as Utils from 'utils/utils.jsx';
import {FormattedMessage} from 'react-intl';

import EmojiPickerCategory from './components/emoji_picker_category.jsx';
import EmojiPickerItem from './components/emoji_picker_item.jsx';
import EmojiPickerPreview from './components/emoji_picker_preview.jsx';

import PeopleSpriteSheet from 'images/emoji-sheets/people.png';
import NatureSpriteSheet from 'images/emoji-sheets/nature.png';
import FoodsSpriteSheet from 'images/emoji-sheets/foods.png';
import ActivitySpriteSheet from 'images/emoji-sheets/activity.png';
import PlacesSpriteSheet from 'images/emoji-sheets/places.png';
import ObjectsSpriteSheet from 'images/emoji-sheets/objects.png';
import SymbolsSpriteSheet from 'images/emoji-sheets/symbols.png';
import FlagsSpriteSheet from 'images/emoji-sheets/flags.png';

// This should include all the categories available in Emoji.CategoryNames
const CATEGORIES = [
    'recent',
    'people',
    'nature',
    'foods',
    'activity',
    'places',
    'objects',
    'symbols',
    'flags',
    'custom'
];

export default class EmojiPicker extends React.Component {
    static propTypes = {
        style: PropTypes.object,
        rightOffset: PropTypes.number,
        topOffset: PropTypes.number,
        placement: PropTypes.oneOf(['top', 'bottom', 'left']),
        customEmojis: PropTypes.object,
        onEmojiClick: PropTypes.func.isRequired
    }

    static defaultProps = {
        rightOffset: 0,
        topOffset: 0
    };

    constructor(props) {
        super(props);

        // All props are primitives or treated as immutable
        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.handlePreload = this.handlePreload.bind(this);
        this.handleCategoryClick = this.handleCategoryClick.bind(this);
        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleItemOver = this.handleItemOver.bind(this);
        this.handleItemOut = this.handleItemOut.bind(this);
        this.handleItemClick = this.handleItemClick.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleItemUnmount = this.handleItemUnmount.bind(this);
        this.renderCategory = this.renderCategory.bind(this);

        this.state = {
            category: 'recent',
            filter: '',
            selected: null,
            preloaded: []
        };
    }

    componentDidMount() {
        // Delay taking focus because this briefly renders offscreen when using an Overlay
        // so focusing it immediately on mount can cause weird scrolling
        requestAnimationFrame(() => {
            this.searchInput.focus();
        });
        beginPreloading();
        subscribeToPreloads(this.handlePreload);
        this.handlePreload();
    }

    componentWillUnmount() {
        unsubscribeFromPreloads(this.handlePreload);
    }

    handlePreload() {
        const preloaded = [];
        for (const category of CATEGORIES) {
            if (didPreloadCategory(category)) {
                preloaded.push(category);
            }
        }
        this.setState({preloaded});
    }

    handleCategoryClick(category) {
        const items = this.refs.items;

        if (category === CATEGORIES[0]) {
            // First category includes the search box so just scroll to the top
            items.scrollTop = 0;
        } else {
            const cat = this.refs[category];
            items.scrollTop = cat.offsetTop;
        }
    }

    handleFilterChange(e) {
        this.setState({filter: e.target.value});
    }

    handleItemOver(emoji) {
        clearTimeout(this.timeouthandler);
        this.setState({
            selected: emoji
        });
    }

    handleItemOut() {
        this.timeouthandler = setTimeout(() => this.setState({
            selected: null
        }), 500);
    }

    handleItemUnmount(emoji) {
        // Prevent emoji preview from showing emoji which is not present anymore (due to filter)
        if (this.state.selected === emoji) {
            this.setState({
                selected: null
            });
        }
    }

    handleItemClick(emoji) {
        this.props.onEmojiClick(emoji);
    }

    handleScroll() {
        const items = this.refs.items;
        const contentTop = items.scrollTop;
        const itemsPaddingTop = getComputedStyle(items).paddingTop;
        const contentTopPadding = parseInt(itemsPaddingTop, 10);
        const scrollPct = (contentTop / (items.scrollHeight - items.clientHeight)) * 100.0;

        if (scrollPct > 99.0) {
            this.setState({category: 'custom'});
            return;
        }

        for (const category of CATEGORIES) {
            const header = this.refs[category];
            const headerStyle = getComputedStyle(header);
            const headerBottomMargin = parseInt(headerStyle.marginBottom, 10);
            const headerBottomPadding = parseInt(headerStyle.paddingBottom, 10);
            const headerBottomSpace = headerBottomMargin + headerBottomPadding;
            const headerBottom = header.offsetTop + header.offsetHeight + headerBottomSpace;

            // If category is the first one visible, highlight it in the bar at the top
            if (headerBottom - contentTopPadding >= contentTop) {
                if (this.state.category !== category) {
                    this.setState({category: String(category)});
                }

                break;
            }
        }
    }

    renderCategory(category, isLoaded, filter) {
        let emojis;
        if (category === 'recent') {
            const recentEmojis = [...EmojiStore.getRecentEmojis()];

            // Reverse so most recently added is first
            recentEmojis.reverse();

            emojis = recentEmojis.filter((name) => {
                return EmojiStore.has(name);
            }).map((name) => {
                return EmojiStore.get(name);
            });
        } else {
            const indices = Emoji.EmojiIndicesByCategory.get(category) || [];

            emojis = indices.map((index) => Emoji.Emojis[index]);

            if (category === 'custom') {
                emojis = emojis.concat([...EmojiStore.getCustomEmojiMap().values()]);
            }
        }

        // Apply filter
        emojis = emojis.filter((emoji) => {
            if (emoji.name) {
                return emoji.name.indexOf(filter) !== -1;
            }

            for (const alias of emoji.aliases) {
                if (alias.indexOf(filter) !== -1) {
                    return true;
                }
            }

            return false;
        });

        const items = emojis.map((emoji) => {
            const name = emoji.name || emoji.aliases[0];
            let key;
            if (category === 'recent') {
                key = 'system_recent_' + name;
            } else if (category === 'custom' && emoji.name) {
                key = 'custom_' + name;
            } else {
                key = 'system_' + name;
            }

            return (
                <EmojiPickerItem
                    key={key}
                    emoji={emoji}
                    category={category}
                    isLoaded={isLoaded}
                    onItemOver={this.handleItemOver}
                    onItemOut={this.handleItemOut}
                    onItemClick={this.handleItemClick}
                    onItemUnmount={this.handleItemUnmount}
                />
            );
        });

        // Only render the header if there's any visible items
        let header = null;
        if (items.length > 0) {
            header = (
                <div className='emoji-picker__category-header'>
                    <FormattedMessage id={'emoji_picker.' + category}/>
                </div>
            );
        }

        return (
            <div
                key={'category_' + category}
                id={'emojipickercat-' + category}
                ref={category}
            >
                {header}
                <div className='emoji-picker-items__container'>
                    {items}
                </div>
            </div>
        );
    }

    render() {
        const items = [];

        for (const category of CATEGORIES) {
            if (category === 'custom') {
                items.push(this.renderCategory('custom', true, this.state.filter, this.props.customEmojis));
            } else {
                items.push(this.renderCategory(category, category === 'recent' || this.state.preloaded.indexOf(category) >= 0, this.state.filter));
            }
        }

        let pickerStyle;
        if (this.props.style && !(this.props.style.left === 0 || this.props.style.top === 0)) {
            if (this.props.placement === 'top' || this.props.placement === 'bottom') {
                // Only take the top/bottom position passed by React Bootstrap since we want to be right-aligned
                pickerStyle = {
                    top: this.props.style.top,
                    bottom: this.props.style.bottom,
                    right: this.props.rightOffset
                };
            } else {
                pickerStyle = {...this.props.style};
            }
        }

        if (pickerStyle && pickerStyle.top) {
            pickerStyle.top += this.props.topOffset;
        }

        return (
            <div
                className='emoji-picker'
                style={pickerStyle}
            >
                <div className='emoji-picker__categories'>
                    <EmojiPickerCategory
                        category='recent'
                        icon={
                            <i
                                className='fa fa-clock-o'
                                title={Utils.localizeMessage('emoji_picker.recent', 'Recently Used')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'recent'}
                    />
                    <EmojiPickerCategory
                        category='people'
                        icon={
                            <i
                                className='fa fa-smile-o'
                                title={Utils.localizeMessage('emoji_picker.people', 'People')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'people'}
                    />
                    <EmojiPickerCategory
                        category='nature'
                        icon={
                            <i
                                className='fa fa-leaf'
                                title={Utils.localizeMessage('emoji_picker.nature', 'Nature')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'nature'}
                    />
                    <EmojiPickerCategory
                        category='foods'
                        icon={
                            <i
                                className='fa fa-cutlery'
                                title={Utils.localizeMessage('emoji_picker.foods', 'Foods')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'foods'}
                    />
                    <EmojiPickerCategory
                        category='activity'
                        icon={
                            <i
                                className='fa fa-futbol-o'
                                title={Utils.localizeMessage('emoji_picker.activity', 'Activity')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'activity'}
                    />
                    <EmojiPickerCategory
                        category='places'
                        icon={
                            <i
                                className='fa fa-plane'
                                title={Utils.localizeMessage('emoji_picker.places', 'Places')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'places'}
                    />
                    <EmojiPickerCategory
                        category='objects'
                        icon={
                            <i
                                className='fa fa-lightbulb-o'
                                title={Utils.localizeMessage('emoji_picker.objects', 'Objects')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'objects'}
                    />
                    <EmojiPickerCategory
                        category='symbols'
                        icon={
                            <i
                                className='fa fa-heart-o'
                                title={Utils.localizeMessage('emoji_picker.symbols', 'Symbols')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'symbols'}
                    />
                    <EmojiPickerCategory
                        category='flags'
                        icon={
                            <i
                                className='fa fa-flag-o'
                                title={Utils.localizeMessage('emoji_picker.flags', 'Flags')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'flags'}
                    />
                    <EmojiPickerCategory
                        category='custom'
                        icon={
                            <i
                                className='fa fa-at'
                                title={Utils.localizeMessage('emoji_picker.custom', 'Custom')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'custom'}
                    />
                </div>
                <div className='emoji-picker__search-container'>
                    <span className='fa fa-search emoji-picker__search-icon'/>
                    <input
                        ref={(input) => {
                            this.searchInput = input;
                        }}
                        className='emoji-picker__search'
                        type='text'
                        onChange={this.handleFilterChange}
                        placeholder={Utils.localizeMessage('emoji_picker.search', 'search')}
                    />
                </div>
                <div
                    ref='items'
                    id='emojipickeritems'
                    className='emoji-picker__items'
                    onScroll={this.handleScroll}
                >
                    {items}
                </div>
                <EmojiPickerPreview
                    emoji={this.state.selected}
                />
            </div>
        );
    }
}

var preloads = {
    people: {
        src: PeopleSpriteSheet,
        didPreload: false
    },
    nature: {
        src: NatureSpriteSheet,
        didPreload: false
    },
    foods: {
        src: FoodsSpriteSheet,
        didPreload: false
    },
    activity: {
        src: ActivitySpriteSheet,
        didPreload: false
    },
    places: {
        src: PlacesSpriteSheet,
        didPreload: false
    },
    objects: {
        src: ObjectsSpriteSheet,
        didPreload: false
    },
    symbols: {
        src: SymbolsSpriteSheet,
        didPreload: false
    },
    flags: {
        src: FlagsSpriteSheet,
        didPreload: false
    }
};

var didBeginPreloading = false;

var preloadCallback = null;

export function beginPreloading() {
    if (didBeginPreloading) {
        return;
    }
    didBeginPreloading = true;
    preloadNextCategory();
}

function preloadNextCategory() {
    let sheet = null;
    for (const category of CATEGORIES) {
        const preload = preloads[category];
        if (preload && !preload.didPreload) {
            sheet = preload;
            break;
        }
    }
    if (sheet) {
        const img = new Image();
        img.onload = () => {
            sheet.didPreload = true;
            if (preloadCallback) {
                preloadCallback();
            }
            preloadNextCategory();
        };
        img.src = sheet.src;
    }
}

export function didPreloadCategory(category) {
    const preload = preloads[category];
    return preload && preload.didPreload;
}

function subscribeToPreloads(callback) {
    preloadCallback = callback;
}

function unsubscribeFromPreloads(callback) {
    if (callback === preloadCallback) {
        preloadCallback = null;
    }
}
