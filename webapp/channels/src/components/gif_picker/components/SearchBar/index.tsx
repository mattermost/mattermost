// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GfycatAPITag} from '@mattermost/types/gifs';
import React, {ChangeEvent, Component, FormEvent, RefObject} from 'react';
import {connect} from 'react-redux';

import {saveSearchScrollPosition, saveSearchBarText, searchTextUpdate} from 'mattermost-redux/actions/gifs';
import {getTheme, Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity, makeStyleFromTheme} from 'mattermost-redux/utils/theme_utils';

import LocalizedInput from 'components/localized_input/localized_input';
import GifSearchClearIcon from 'components/widgets/icons/gif_search_clear_icon';
import GifSearchIcon from 'components/widgets/icons/gif_search_icon';

import {GlobalState} from 'types/store';
import {t} from 'utils/i18n';

import './SearchBar.scss';

function mapStateToProps(state: GlobalState) {
    return {
        ...state.entities.gifs.categories,
        ...state.entities.gifs.search,
        theme: getTheme(state),
        appProps: state.entities.gifs.app,
    };
}

const mapDispatchToProps = ({
    saveSearchBarText,
    saveSearchScrollPosition,
    searchTextUpdate,
});

const getStyle = makeStyleFromTheme((theme) => {
    return {
        background: {
            backgroundColor: theme.centerChannelBg,
        },
        icon: {
            fill: changeOpacity(theme.centerChannelColor, 0.4),
        },
        inputBackground: {
            backgroundColor: theme.centerChannelBg,
        },
        input: {
            borderColor: changeOpacity(theme.centerChannelColor, 0.12),
        },
    };
});

type Props = {
    action?: string;
    theme: Theme;
    onSearch?: () => void;
    onTrending?: () => void;
    onCategories?: () => void;
    saveSearchBarText: (searchBarText: string) => void;
    saveSearchScrollPosition?: (scrollPosition: number) => void;
    searchTextUpdate: (searchText: string) => void;
    searchBarText?: string;
    defaultSearchText?: string;
    tagsList?: GfycatAPITag[];
    hasImageProxyd?: string;
    handleSearchTextChange: (text: string) => void;
}

type State = {
    inputFocused: boolean;
}

export class SearchBar extends Component<Props, State> {
    private searchTimeout!: NodeJS.Timeout;
    private searchInputRef: RefObject<HTMLInputElement>;

    constructor(props: Props) {
        super(props);

        this.state = {inputFocused: false};
        this.searchInputRef = React.createRef();

        const defaultSearchText = this.props.defaultSearchText || '';

        this.props.saveSearchBarText(defaultSearchText);
        this.props.searchTextUpdate(defaultSearchText);
    }

    componentDidUpdate(prevProps: Props) {
        const {searchBarText} = this.props;

        if (searchBarText !== prevProps.searchBarText) {
            if (!searchBarText || searchBarText === 'trending') {
                this.updateSearchInputValue('');
            } else {
                this.updateSearchInputValue(searchBarText);
            }
        }
    }

    /**
     * Returns text request with hyphens
     */
    parseSearchText = (searchText: string) => searchText.trim().split(/ +/).join('-');

    removeExtraSpaces = (searchText: string) => searchText.trim().split(/ +/).join(' ');

    updateSearchInputValue = (searchText: string) => {
        if (this.searchInputRef.current) {
            this.searchInputRef.current.value = searchText;
        }
        this.props.saveSearchBarText(searchText);
        this.props.handleSearchTextChange(searchText);
    };

    handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        this.triggerSearch(this.searchInputRef.current?.value || '');
        this.searchInputRef.current?.blur();
    };

    triggerSearch = (searchText: string) => {
        const {onSearch} = this.props;
        this.props.searchTextUpdate(this.parseSearchText(searchText));
        onSearch?.();
        this.props.saveSearchScrollPosition?.(0);
    };

    handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        clearTimeout(this.searchTimeout);

        const searchText = event.target.value;

        const {onCategories, action} = this.props;
        this.props.saveSearchBarText(searchText);
        this.props.handleSearchTextChange(searchText);

        if (searchText === '') {
            onCategories?.();
        } else if (action !== 'reactions' || !this.isFilteredTags(searchText)) {
            // not reactions page or there's no reactions for this search request
            this.searchTimeout = setTimeout(() => {
                this.triggerSearch(searchText);
            }, 500);
        }
    };

    focusInput = () => this.setState({inputFocused: true});
    blurInput = () => this.setState({inputFocused: false});

    /**
     * Checks if there're reactions for a current searchText
     */
    isFilteredTags = (searchText: string) => {
        const text = this.removeExtraSpaces(searchText);

        const {tagsList} = this.props;
        const substr = text.toLowerCase();
        const filteredTags = tagsList && tagsList.length ? tagsList.filter((tag) => {
            if (!text || tag.tagName.indexOf(substr) !== -1) {
                return tag;
            }
            return '';
        }) : [];

        return Boolean(filteredTags.length);
    };

    clearSearchHandle = () => {
        const {action, onTrending, onCategories} = this.props;
        this.updateSearchInputValue('');
        if (action === 'reactions') {
            onCategories?.();
        } else {
            onTrending?.();
        }
    };

    shouldComponentUpdate(nextProps: Props, nextState: State) {
        return ((!nextProps.searchBarText && this.props.searchBarText) ||
            (nextProps.searchBarText && !this.props.searchBarText) ||
            (nextState.inputFocused !== this.state.inputFocused) ||
            (nextProps.searchBarText !== this.props.searchBarText)) as boolean;
    }

    render() {
        const style = getStyle(this.props.theme);
        const {searchBarText} = this.props;
        const clearSearchButton = searchBarText ? (
            <GifSearchClearIcon
                className='ic-clear-search'
                style={style.icon}
                onClick={this.clearSearchHandle}
            />
        ) : null;

        return (
            <form
                className='gfycat-search'
                method='get'
                target='_top'
                onSubmit={this.handleSubmit}
            >
                <div
                    className='search-bar'
                    style={style.background}
                >
                    <div
                        className='search-input-bg'
                        style={style.inputBackground}
                    />
                    <LocalizedInput
                        className='search-input'
                        name='searchText'
                        autoFocus={true}
                        placeholder={{id: t('gif_picker.gfycat'), defaultMessage: 'Search Gfycat'}}
                        onChange={this.handleChange}
                        autoComplete='off'
                        autoCapitalize='off'
                        onFocus={this.focusInput}
                        onBlur={this.blurInput}
                        ref={this.searchInputRef}
                        style={style.input}
                        value={searchBarText}
                    />
                    <GifSearchIcon
                        className='ic ic-search'
                        style={style.icon}
                    />
                    {clearSearchButton}
                </div>
                <button
                    type='submit'
                    className='submit-button'
                />
            </form>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchBar);

