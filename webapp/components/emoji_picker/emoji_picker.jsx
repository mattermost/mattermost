// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import $ from 'jquery';
import * as Emoji from 'utils/emoji.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';

import EmojiPickerCategory from './components/emoji_picker_category.jsx';
import EmojiPickerItem from './components/emoji_picker_item.jsx';
import EmojiPickerPreview from './components/emoji_picker_preview.jsx';
import {FormattedMessage} from 'react-intl';

// This should include all the categories available in Emoji.CategoryNames
const CATEGORIES = [
    'recent',
    'people',
    'nature',
    'food',
    'activity',
    'travel',
    'objects',
    'symbols',
    'flags',
    'custom'
];

export default class EmojiPicker extends React.Component {
    static propTypes = {
        customEmojis: React.PropTypes.object.isRequired,
        onEmojiClick: React.PropTypes.func.isRequred
    }

    constructor(props) {
        super(props);

        // All props are primitives or treated as immutable
        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.handleCategoryClick = this.handleCategoryClick.bind(this);
        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleItemOver = this.handleItemOver.bind(this);
        this.handleItemOut = this.handleItemOut.bind(this);
        this.handleItemClick = this.handleItemClick.bind(this);
        this.handleScroll = this.handleScroll.bind(this);

        this.renderCategory = this.renderCategory.bind(this);

        this.state = {
            category: 'recent',
            filter: '',
            selected: null
        };
    }

    handleCategoryClick(category) {
        if (category === CATEGORIES[0]) {
            // First category includes the search box so just scroll to the top
            const items = $(ReactDOM.findDOMNode(this.refs.items));
            items.scrollTop(0);
        } else {
            ReactDOM.findDOMNode(this.refs[category]).scrollIntoView();
        }
    }

    handleFilterChange(e) {
        this.setState({filter: e.target.value});
    }

    handleItemOver(emoji) {
        this.setState({selected: emoji});
    }

    handleItemOut(emoji) {
        if (this.state.selected === emoji) {
            this.setState({selected: null});
        }
    }

    handleItemClick(emoji) {
        this.props.onEmojiClick(emoji);
    }

    handleScroll() {
        const items = $(ReactDOM.findDOMNode(this.refs.items));

        const contentTop = items.scrollTop();
        const contentTopPadding = parseInt(items.css('padding-top'), 10);

        for (const category of CATEGORIES) {
            const header = $(ReactDOM.findDOMNode(this.refs[category]));
            const headerBottomMargin = parseInt(header.css('margin-bottom'), 10) + parseInt(header.css('padding-bottom'), 10);
            const headerBottom = header[0].offsetTop + header.height() + headerBottomMargin;

            // If category is the first one visible, highlight it in the bar at the top
            if (headerBottom - contentTopPadding >= contentTop) {
                if (this.state.category !== category) {
                    this.setState({category});
                }

                break;
            }
        }
    }

    renderCategory(category, filter, customEmojis = []) {
        const items = [];

        const indices = Emoji.EmojiIndicesByCategory.get(category) || [];

        for (const index of indices) {
            const emoji = Emoji.Emojis[index];

            if (filter) {
                let matches = false;

                for (const alias of emoji.aliases) {
                    if (alias.indexOf(filter) !== -1) {
                        matches = true;
                        break;
                    }
                }

                if (!matches) {
                    continue;
                }
            }

            items.push(
                <EmojiPickerItem
                    key={'system_' + emoji.aliases[0]}
                    emoji={emoji}
                    onItemOver={this.handleItemOver}
                    onItemOut={this.handleItemOut}
                    onItemClick={this.handleItemClick}
                />
            );
        }

        for (const [, emoji] of customEmojis) {
            if (filter && emoji.name.indexOf(filter) === -1) {
                continue;
            }

            items.push(
                <EmojiPickerItem
                    key={'custom_' + emoji.name}
                    emoji={emoji}
                    onItemOver={this.handleItemOver}
                    onItemOut={this.handleItemOut}
                    onItemClick={this.handleItemClick}
                />
            );
        }

        // Only render the header if there's any visible items
        let header = null;
        if (items.length > 0) {
            header = (
                <div
                    className='emoji-picker__category-header'
                >
                    <FormattedMessage id={'emoji_picker.' + category}/>
                </div>
            );
        }

        return (
            <div
                key={'category_' + category}
                ref={category}
            >
                {header}
                {items}
            </div>
        );
    }

    renderPreview(selected) {
        if (selected) {
            let name;
            let aliases;
            if (selected.name) {
                // This is a custom emoji that matches the model on the server
                name = selected.name;
                aliases = [selected.name];
            } else {
                // This is a system emoji which only has a list of aliases
                name = selected.aliases[0];
                aliases = selected.aliases;
            }

            return (
                <div className='emoji-picker__preview'>
                    <img
                        className='emoji-picker__preview-image'
                        align='absmiddle'
                        src={EmojiStore.getEmojiImageUrl(selected)}
                    />
                    <span className='emoji-picker__preview-name'>{name}</span>
                    <span className='emoji-picker__preview-aliases'>{aliases.map((alias) => ':' + alias + ':').join(' ')}</span>
                </div>
            );
        }

        return (
            <span className='emoji-picker__preview-placeholder'>
                <FormattedMessage
                    id='emoji_picker.emojiPicker'
                    defaultMessage='Emoji Picker'
                />
            </span>
        );
    }

    render() {
        const items = [];

        for (const category of CATEGORIES) {
            if (category === 'custom') {
                items.push(this.renderCategory('custom', this.state.filter, this.props.customEmojis));
            } else {
                items.push(this.renderCategory(category, this.state.filter));
            }
        }

        return (
            <div className='emoji-picker'>
                <div className='emoji-picker__categories'>
                    <EmojiPickerCategory
                        category='recent'
                        icon={<i className='fa fa-clock-o'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'recent'}
                    />
                    <EmojiPickerCategory
                        category='people'
                        icon={<i className='fa fa-smile-o'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'people'}
                    />
                    <EmojiPickerCategory
                        category='nature'
                        icon={<i className='fa fa-leaf'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'nature'}
                    />
                    <EmojiPickerCategory
                        category='food'
                        icon={<i className='fa fa-cutlery'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'food'}
                    />
                    <EmojiPickerCategory
                        category='activity'
                        icon={<i className='fa fa-futbol-o'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'activity'}
                    />
                    <EmojiPickerCategory
                        category='travel'
                        icon={<i className='fa fa-plane'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'travel'}
                    />
                    <EmojiPickerCategory
                        category='objects'
                        icon={<i className='fa fa-lightbulb-o'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'objects'}
                    />
                    <EmojiPickerCategory
                        category='symbols'
                        icon={<i className='fa fa-heart-o'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'symbols'}
                    />
                    <EmojiPickerCategory
                        category='flags'
                        icon={<i className='fa fa-flag-o'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'flags'}
                    />
                    <EmojiPickerCategory
                        category='custom'
                        icon={<i className='fa fa-at'/>}
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'custom'}
                    />
                </div>
                <div
                    ref='items'
                    className='emoji-picker__items'
                    onScroll={this.handleScroll}
                >
                    <div className='emoji-picker__search-container'>
                        <span className='fa fa-search emoji-picker__search-icon'/>
                        <input
                            className='emoji-picker__search'
                            type='text'
                            onChange={this.handleFilterChange}
                            placeholder={Utils.localizeMessage('emoji_picker.search', 'search')}
                        />
                    </div>
                    {items}
                </div>
                <EmojiPickerPreview emoji={this.state.selected}/>
            </div>
        );
    }
}