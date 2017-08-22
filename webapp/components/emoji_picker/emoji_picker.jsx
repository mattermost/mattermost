// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import * as Emoji from 'utils/emoji.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import * as Utils from 'utils/utils.jsx';
import {FormattedMessage} from 'react-intl';

import EmojiPickerCategory from './components/emoji_picker_category.jsx';
import EmojiPickerItem from './components/emoji_picker_item.jsx';
import EmojiPickerPreview from './components/emoji_picker_preview.jsx';
import EmojiList from './emoji_list.jsx';

const ROW_SIZE = 30;
const EMOJI_PER_ROW = 9;

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

        this.handleCategoryClick = this.handleCategoryClick.bind(this);
        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleItemOver = this.handleItemOver.bind(this);
        this.handleItemOut = this.handleItemOut.bind(this);
        this.handleItemClick = this.handleItemClick.bind(this);
        this.handleOnScroll = this.handleOnScroll.bind(this);
        this.handleItemUnmount = this.handleItemUnmount.bind(this);

        this.categories = {
            recent: {name: 'recent', className: 'fa fa-clock-o', id: 'emoji_picker.recent', message: 'Recently Used', offset: 0, enable: false},
            people: {name: 'people', className: 'fa fa-smile-o', id: 'emoji_picker.people', message: 'People', offset: 0, enable: false},
            nature: {name: 'nature', className: 'fa fa-leaf', id: 'emoji_picker.nature', message: 'Nature', offset: 0, enable: false},
            foods: {name: 'foods', className: 'fa fa-cutlery', id: 'emoji_picker.foods', message: 'Foods', offset: 0, enable: false},
            activity: {name: 'activity', className: 'fa fa-futbol-o', id: 'emoji_picker.activity', message: 'Activity', offset: 0, enable: false},
            places: {name: 'places', className: 'fa fa-plane', id: 'emoji_picker.places', message: 'Places', offset: 0, enable: false},
            objects: {name: 'objects', className: 'fa fa-lightbulb-o', id: 'emoji_picker.objects', message: 'Objects', offset: 0, enable: false},
            symbols: {name: 'symbols', className: 'fa fa-heart-o', id: 'emoji_picker.symbols', message: 'Symbols', offset: 0, enable: false},
            flags: {name: 'flags', className: 'fa fa-flag-o', id: 'emoji_picker.flags', message: 'Fags', offset: 0, enable: false},
            custom: {name: 'custom', className: 'fa fa-at', id: 'emoji_picker.custom', message: 'Custom', offset: 0, enable: false}
        };

        this.state = {
            category: 'recent',
            filter: '',
            selected: null,
            list: this.generateList(''),
            scrollOffset: 0
        };
    }

    componentDidMount() {
        // Delay taking focus because this briefly renders offscreen when using an Overlay
        // so focusing it immediately on mount can cause weird scrolling
        requestAnimationFrame(() => {
            this.searchInput.focus();
        });
    }

    handleCategoryClick(category) {
        const scrollOffset = this.categories[category].offset;

        this.setState({
            scrollOffset,
            category
        });
    }

    handleFilterChange(e) {
        e.preventDefault();

        for (const category of Object.keys(this.categories)) {
            this.categories[category].offset = 0;
            this.categories[category].enable = false;
        }

        const filter = e.target.value;

        this.setState({
            category: 'recent',
            selected: null,
            scrollOffset: 0,
            list: this.generateList(filter),
            filter
        });
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

    handleOnScroll(offset) {
        let category = 'recent';
        for (const cat of Object.keys(this.categories)) {
            if (offset < this.categories[cat].offset) {
                break;
            }

            category = this.categories[cat].name;
        }

        this.setState({category});
    }

    generateEmojiHeaderRow(category) {
        return (
            <div
                id={'emojipickercat-' + category}
                key={category}
                className='emoji-picker__category-header'
            >
                <FormattedMessage id={'emoji_picker.' + category}/>
            </div>
        );
    }

    generateEmojiRows(emojis, category) {
        return emojis.map((emoji) => {
            const name = emoji.name || emoji.aliases[0];
            const key = category + '-' + name;

            return (
                <EmojiPickerItem
                    key={key}
                    emoji={emoji}
                    onItemOver={this.handleItemOver}
                    onItemOut={this.handleItemOut}
                    onItemClick={this.handleItemClick}
                    onItemUnmount={this.handleItemUnmount}
                />
            );
        });
    }

    addEmojiRow(list, emojiRows) {
        let arr = [];
        for (let i = 0; i < emojiRows.length; i += EMOJI_PER_ROW) {
            arr = emojiRows.slice(i, i + EMOJI_PER_ROW);
            list.push(arr);
        }

        return list;
    }

    getEmojis(category, filter) {
        // check to filter first before building emojis
        let emojis = [];

        if (category === 'recent') {
            const recentEmojis = [...EmojiStore.getRecentEmojis()].reverse();

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

        return filter ? this.filterEmojis(emojis, filter) : emojis;
    }

    filterEmojis(emojis, filter) {
        return emojis.filter((emoji) => {
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
    }

    generateList(filter) {
        let list = [];

        for (const category of Object.keys(this.categories)) {
            const emojis = this.getEmojis(category, filter);

            if (emojis.length) {
                this.categories[category].offset = list.length * ROW_SIZE;
                this.categories[category].enable = true;

                const emojiHeaderRow = this.generateEmojiHeaderRow(category);
                list.push(emojiHeaderRow);

                const emojiRows = this.generateEmojiRows(emojis, category);
                list = this.addEmojiRow(list, emojiRows);
            }
        }

        return list;
    }

    emojiCategories() {
        const categories = this.categories;

        const emojiPickerCategories = Object.keys(categories).map((category) => {
            return (
                <EmojiPickerCategory
                    key={'header-' + categories[category].name}
                    category={categories[category].name}
                    icon={
                        <i
                            className={this.categories[category].className}
                            title={Utils.localizeMessage(categories[category].id, categories[category].message)}
                        />
                    }
                    onCategoryClick={this.handleCategoryClick}
                    selected={this.state.category === categories[category].name}
                    enable={categories[category].enable}
                />
            );
        });

        return (
            <div className='emoji-picker__categories'>
                {emojiPickerCategories}
            </div>
        );
    }

    emojiSearch() {
        return (
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
        );
    }

    render() {
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
                {this.emojiCategories()}
                {this.emojiSearch()}
                <EmojiList
                    width='100%'
                    height={300}
                    itemCount={this.state.list.length}
                    itemSize={ROW_SIZE}
                    scrollOffset={this.state.scrollOffset}
                    onScroll={this.handleOnScroll}
                    renderItem={({index, style}) =>
                        <div
                            key={index}
                            style={style}
                        >
                            {this.state.list[index]}
                        </div>
                    }
                />
                <EmojiPickerPreview
                    emoji={this.state.selected}
                />
            </div>
        );
    }
}
