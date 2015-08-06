// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName:'SettingsSidebar',
    updateTab: function(tab) {
        this.props.updateTab(tab);
        $('.settings-modal').addClass('display--content');
    },
    render: function() {
        var self = this;
        return (
            <div className="">
                <ul className="nav nav-pills nav-stacked">
                    {this.props.tabs.map(function(tab) {
                        return <li key={tab.name+'_li'} className={self.props.activeTab == tab.name ? 'active' : ''}><a key={tab.name + '_a'} href="#" onClick={function(){self.updateTab(tab.name);}}><i key={tab.name+'_i'} className={tab.icon}></i>{tab.ui_name}</a></li>
                    })}
                </ul>
            </div>
        );
    }
});
