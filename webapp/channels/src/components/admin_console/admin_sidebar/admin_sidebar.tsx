// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import isEqual from 'lodash/isEqual';
import React from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {PluginRedux} from '@mattermost/types/plugins';

import AdminSidebarCategory from 'components/admin_console/admin_sidebar/admin_sidebar_category';
import AdminSidebarSection from 'components/admin_console/admin_sidebar/admin_sidebar_section';
import AdminSidebarHeader from 'components/admin_console/admin_sidebar_header';
import SearchKeywordMarking from 'components/admin_console/search_keyword_marking';
import QuickInput from 'components/quick_input';
import SearchIcon from 'components/widgets/icons/search_icon';

import {generateIndex} from 'utils/admin_console_index';
import type {Index} from 'utils/admin_console_index';
import {getHistory} from 'utils/browser_history';

import type AdminDefinition from '../admin_definition';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux {
    intl: IntlShape;
    onSearchChange: (term: string) => void;
}

type State = {
    sections: string[] | null;
    filter: string;
}

const renderScrollView = (props: Props) => (
    <div
        {...props}
        className='scrollbar--view'
    />
);

const renderScrollThumbHorizontal = (props: Props) => (
    <div
        {...props}
        className='scrollbar--horizontal'
    />
);

const renderScrollThumbVertical = (props: Props) => (
    <div
        {...props}
        className='scrollbar--vertical'
    />
);

class AdminSidebar extends React.PureComponent<Props, State> {
    searchRef: React.RefObject<HTMLInputElement>;
    idx: Index | null;

    static defaultProps = {
        plugins: {},
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            sections: null,
            filter: '',
        };
        this.idx = null;
        this.searchRef = React.createRef();
    }

    componentDidMount() {
        if (this.props.config.PluginSettings?.Enable) {
            this.props.actions.getPlugins();
        }

        if (this.searchRef.current) {
            this.searchRef.current.focus();
        }

        this.updateTitle();
    }

    componentDidUpdate(prevProps: Props) {
        if (this.idx !== null &&
            (!isEqual(this.props.plugins, prevProps.plugins) ||
                !isEqual(this.props.adminDefinition, prevProps.adminDefinition))) {
            this.idx = generateIndex(this.props.adminDefinition, this.props.intl, this.props.plugins);
        }
    }

    handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filter = e.target.value;
        if (filter === '') {
            this.setState({sections: null, filter});
            this.props.onSearchChange(filter);
            return;
        }

        if (this.idx === null) {
            this.idx = generateIndex(this.props.adminDefinition, this.props.intl, this.props.plugins);
        }
        let query = '';
        for (const term of filter.split(' ')) {
            term.trim();
            if (term !== '') {
                query += term + ' ';
                query += term + '* ';
            }
        }
        const sections = this.idx.search(query);
        this.setState({sections, filter});
        this.props.onSearchChange(filter);

        if (this.props.navigationBlocked) {
            return;
        }

        const validSection = sections.indexOf(getHistory().location.pathname.replace('/admin_console/', '')) !== -1;
        if (!validSection) {
            const visibleSections = this.visibleSections();
            for (const section of sections) {
                if (visibleSections.has(section)) {
                    getHistory().replace('/admin_console/' + section);
                    break;
                }
            }
        }
    };

    updateTitle = () => {
        let currentSiteName = '';
        if (this.props.siteName) {
            currentSiteName = ' - ' + this.props.siteName;
        }

        document.title = this.props.intl.formatMessage({id: 'sidebar_right_menu.console', defaultMessage: 'System Console'}) + currentSiteName;
    };

    visibleSections = () => {
        const {config, license, buildEnterpriseReady, consoleAccess, adminDefinition, cloud} = this.props;
        const isVisible = (item: any) => {
            if (!item.schema) {
                return false;
            }

            if (!item.title) {
                return false;
            }

            if (item.isHidden && item.isHidden(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud)) {
                return false;
            }
            return true;
        };
        const result = new Set();
        for (const section of Object.values(adminDefinition)) {
            for (const item of Object.values(section.subsections)) {
                if (isVisible(item)) {
                    result.add(item.url);
                }
            }
        }
        return result;
    };

    renderRootMenu = (definition: typeof AdminDefinition) => {
        const {config, license, buildEnterpriseReady, consoleAccess, cloud, subscriptionProduct} = this.props;
        const sidebarSections: JSX.Element[] = [];
        Object.entries(definition).forEach(([key, section]) => {
            let isSectionHidden = false;
            if (section.isHidden) {
                isSectionHidden = typeof section.isHidden === 'function' ? section.isHidden(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud) : Boolean(section.isHidden);
            }
            if (!isSectionHidden) {
                const sidebarItems: JSX.Element[] = [];
                Object.entries(section.subsections).forEach(([subKey, item]) => {
                    if (!item.title) {
                        return;
                    }

                    if (item.isHidden) {
                        if (typeof item.isHidden === 'function' ? item.isHidden(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud) : Boolean(item.isHidden)) {
                            return;
                        }
                    }

                    if (this.state.sections !== null) {
                        let active = false;
                        for (const url of this.state.sections) {
                            if (url === item.url) {
                                active = true;
                            }
                        }
                        if (!active) {
                            return;
                        }
                    }
                    const subDefinitionKey = `${key}.${subKey}`;
                    sidebarItems.push((
                        <AdminSidebarSection
                            key={subDefinitionKey}
                            definitionKey={subDefinitionKey}
                            name={item.url}
                            restrictedIndicator={item.restrictedIndicator?.shouldDisplay(license, subscriptionProduct) ? item.restrictedIndicator.value(cloud) : undefined}
                            title={
                                typeof item.title === 'string' ?
                                    item.title :
                                    <FormattedMessage
                                        {...item.title}
                                    />
                            }
                        />
                    ));
                });

                // Special case for plugins entries
                if ((section as typeof AdminDefinition['plugins']).id === 'plugins') {
                    const sidebarPluginItems = this.renderPluginsMenu();
                    sidebarItems.push(...sidebarPluginItems);
                }

                // If no visible items, don't display this section
                if (sidebarItems.length === 0) {
                    return null;
                }

                sidebarSections.push((
                    <AdminSidebarCategory
                        key={key}
                        definitionKey={key}
                        parentLink='/admin_console'
                        icon={section.icon}
                        sectionClass=''
                        title={
                            typeof section.sectionTitle === 'string' ?
                                section.sectionTitle :
                                <FormattedMessage
                                    {...section.sectionTitle}
                                />
                        }
                    >
                        {sidebarItems}
                    </AdminSidebarCategory>
                ));
            }
            return null;
        });
        return sidebarSections;
    };

    isPluginPresentInSections = (plugin: PluginRedux) => {
        return this.state.sections && this.state.sections.indexOf(`plugin_${plugin.id}`) >= 0;
    };

    renderPluginsMenu = () => {
        const {config, plugins} = this.props;
        if (config.PluginSettings?.Enable && plugins) {
            return Object.values(plugins).sort((a, b) => {
                const nameCompare = a.name.localeCompare(b.name);
                if (nameCompare !== 0) {
                    return nameCompare;
                }

                return a.id.localeCompare(b.id);
            }).
                filter((plugin) => this.state.sections === null || this.isPluginPresentInSections(plugin)).
                map((plugin) => {
                    return (
                        <AdminSidebarSection
                            key={'customplugin' + plugin.id}
                            name={'plugins/plugin_' + plugin.id}
                            title={plugin.name}
                        />
                    );
                });
        }

        return [];
    };

    handleClearFilter = () => {
        this.setState({sections: null, filter: ''});
        this.props.onSearchChange('');
    };

    render() {
        const {showTaskList} = this.props;
        return (
            <div className='admin-sidebar'>
                <AdminSidebarHeader/>
                <div className='filter-container'>
                    <SearchIcon
                        className='search__icon'
                        aria-hidden='true'
                    />
                    <QuickInput
                        className={'filter ' + (this.state.filter ? 'active' : '')}
                        type='text'
                        onChange={this.handleSearchChange}
                        value={this.state.filter}
                        placeholder={this.props.intl.formatMessage({id: 'admin.sidebar.filter', defaultMessage: 'Find settings'})}
                        ref={this.searchRef}
                        id='adminSidebarFilter'
                        clearable={true}
                        onClear={this.handleClearFilter}
                    />
                </div>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderScrollThumbHorizontal}
                    renderThumbVertical={renderScrollThumbVertical}
                    renderView={renderScrollView}
                >
                    <div className='nav-pills__container'>
                        <SearchKeywordMarking keyword={this.state.filter}>
                            <ul className={classNames('nav nav-pills nav-stacked', {'task-list-shown': showTaskList})}>
                                {this.renderRootMenu(this.props.adminDefinition)}
                            </ul>
                        </SearchKeywordMarking>
                    </div>
                </Scrollbars>
            </div>
        );
    }
}

export default injectIntl(AdminSidebar);
