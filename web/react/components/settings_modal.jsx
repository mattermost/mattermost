// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingsSidebar = require('./settings_sidebar.jsx');
var UserSettings = require('./user_settings.jsx');

module.exports = React.createClass({
    componentDidMount: function() {
        $('body').on('click', '.modal-back', function(){
            $(this).closest('.modal-dialog').removeClass('display--content');
        });
        $('body').on('click', '.modal-header .close', function(){
            setTimeout(function() {
                $('.modal-dialog.display--content').removeClass('display--content');
            }, 500);
        });
    },
    updateTab: function(tab) {
        this.setState({ active_tab: tab });
    },
    updateSection: function(section) {
        this.setState({ active_section: section });
    },
    getInitialState: function() {
        return { active_tab: "general", active_section: "" };
    },
    render: function() {
        return (
            <div className="modal fade" ref="modal" id="settings_modal" role="dialog" aria-hidden="true">
              <div className="modal-dialog settings-modal">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title">Account Settings</h4>
                  </div>
                  <div className="modal-body">
                    <div className="settings-table">
                        <div className="settings-links">
                            <SettingsSidebar
                                activeTab={this.state.active_tab}
                                updateTab={this.updateTab}
                            />
                        </div>
                        <div className="settings-content">
                            <UserSettings
                                activeTab={this.state.active_tab}
                                activeSection={this.state.active_section}
                                updateSection={this.updateSection}
                            />
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});

