// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as UserAgent from 'utils/user_agent.jsx';

import PropTypes from 'prop-types';

import React from 'react';

export default class SettingsSidebar extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }
    handleClick(tab, e) {
        e.preventDefault();
        this.props.updateTab(tab.name);
        $(e.target).closest('.settings-modal').addClass('display--content');
    }
    componentDidMount() {
        if (UserAgent.isFirefox()) {
            $('.settings-modal .settings-table .nav').addClass('position--top');
        }
    }
    render() {
        const tabList = this.props.tabs.map((tab) => {
            const key = `${tab.name}_li`;
            let className = '';
            if (this.props.activeTab === tab.name) {
                className = 'active';
            }

            return (
                <li
                    key={key}
                    className={className}
                >
                    <a
                        href='#'
                        onClick={this.handleClick.bind(null, tab)}
                    >
                        <i className={tab.icon}/>
                        {tab.uiName}
                    </a>
                </li>
            );
        });

        return (
            <div>
                <ul className='nav nav-pills nav-stacked'>
                    {tabList}
                </ul>
            </div>
        );
    }
}

SettingsSidebar.propTypes = {
    tabs: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        uiName: PropTypes.string.isRequired,
        icon: PropTypes.string.isRequired
    })).isRequired,
    activeTab: PropTypes.string,
    updateTab: PropTypes.func.isRequired
};
