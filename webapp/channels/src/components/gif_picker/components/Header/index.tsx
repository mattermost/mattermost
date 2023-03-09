// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {connect} from 'react-redux';

import {saveSearchBarText, searchTextUpdate} from 'mattermost-redux/actions/gifs';
import {getTheme, Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity, makeStyleFromTheme} from 'mattermost-redux/utils/theme_utils';

import constants from 'components/gif_picker/utils/constants';
import SearchBar from 'components/gif_picker/components/SearchBar';
import GifTrendingIcon from 'components/widgets/icons/gif_trending_icon';
import GifReactionsIcon from 'components/widgets/icons/gif_reactions_icon';
import './Header.scss';
import {GlobalState} from 'types/store';
import {appProps} from 'components/gif_picker/gif_picker';

function mapStateToProps(state: GlobalState) {
    return {
        theme: getTheme(state),
    };
}

const mapDispatchToProps = ({
    saveSearchBarText,
    searchTextUpdate,
});

type Style = {
    background: {backgroundColor: string};
    header: {borderBottomColor: string};
    icon: {fill: string};
    iconActive: {fill: string};
    iconHover: {fill: string};
}

const getStyle = makeStyleFromTheme((theme) => {
    return {
        background: {
            backgroundColor: theme.centerChannelBg,
        },
        header: {
            borderBottomColor: changeOpacity(theme.centerChannelColor, 0.2),
        },
        icon: {
            fill: changeOpacity(theme.centerChannelColor, 0.3),
        },
        iconActive: {
            fill: theme.centerChannelColor,
        },
        iconHover: {
            fill: changeOpacity(theme.centerChannelColor, 0.8),
        },
    };
});

type Props = {
    action: string;
    appProps: typeof appProps;
    saveSearchBarText: (searchBarText: string) => void;
    searchTextUpdate: (searchText: string) => void;
    theme: Theme;
    defaultSearchText?: string;
    onTrending?: () => void;
    onCategories?: () => void;
    onSearch?: () => void;
    handleSearchTextChange: (text: string) => void;
}

type State = {
    hovering: string;
}

export class Header extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hovering: '',
        };
    }

    render() {
        const style = getStyle(this.props.theme);

        return (
            <header
                className='header-container'
                style={style.background}
            >
                <SearchBar {...this.props}/>
                <nav
                    className='nav-bar'
                    style={style.header}
                >
                    {this.renderTabs(this.props, style)}
                </nav>
            </header>
        );
    }

    renderTabs(props: Props, style: Style) {
        const {appProps, onTrending, onCategories} = props;
        const {header} = appProps;
        return header.tabs.map((tab, index) => {
            let link;
            if (tab === constants.Tab.TRENDING) {
                link = this.renderTab({name: 'trending', callback: onTrending, Icon: GifTrendingIcon, index, style});
            } else if (tab === constants.Tab.REACTIONS) {
                link = this.renderTab({name: 'reactions', callback: onCategories, Icon: GifReactionsIcon, index, style});
            }
            return link;
        });
    }

    renderTab(renderTabParams: {name: string; Icon: typeof GifTrendingIcon; index: number; style: Style; callback?: () => void}) {
        const props = this.props;
        const {action} = props;
        const {Icon} = renderTabParams;
        function callbackWrapper() {
            props.searchTextUpdate('');
            props.saveSearchBarText('');
            renderTabParams.callback?.();
        }
        return (
            <a
                onClick={callbackWrapper}
                onMouseOver={() => {
                    this.setState({hovering: renderTabParams.name});
                }}
                onMouseOut={() => {
                    this.setState({hovering: ''});
                }}
                style={{cursor: 'pointer'}}
                key={renderTabParams.index}
            >
                <div style={{paddingTop: '2px'}}>
                    <Icon
                        style={(() => {
                            if (this.state.hovering === renderTabParams.name) {
                                return renderTabParams.style.iconHover;
                            }
                            return action === renderTabParams.name ? renderTabParams.style.iconActive : renderTabParams.style.icon;
                        })()}
                    />
                </div>
            </a>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Header);
