// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
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
                        return <li className={self.props.activeTab == tab.name ? 'active' : ''}><a href="#" onClick={function(){self.updateTab(tab.name);}}><i className={tab.icon}></i>{tab.ui_name}</a></li>
                    })}
                </ul>
            </div>
        );
    }
});
