// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';

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
        if (Utils.isBrowserFirefox()) {
            $('.settings-modal .settings-table .nav').addClass('position--top');
        }
    }
    render() {
        let tabList = this.props.tabs.map(function makeTab(tab) {
            let key = `${tab.name}_li`;
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
        }.bind(this));

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
    tabs: React.PropTypes.arrayOf(React.PropTypes.shape({
        name: React.PropTypes.string.isRequired,
        uiName: React.PropTypes.string.isRequired,
        icon: React.PropTypes.string.isRequired
    })).isRequired,
    activeTab: React.PropTypes.string,
    updateTab: React.PropTypes.func.isRequired
};
