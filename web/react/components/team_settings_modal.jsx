// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingsSidebar = require('./settings_sidebar.jsx');
var TeamSettings = require('./team_settings.jsx');

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
        return { active_tab: "feature", active_section: "" };
    },
    render: function() {
        var tabs = [];
        tabs.push({name: "feature", ui_name: "Features", icon: "glyphicon glyphicon-wrench"});

        return (
            <div className="modal fade" ref="modal" id="team_settings" role="dialog" aria-hidden="true">
              <div className="modal-dialog settings-modal">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title">Team Settings</h4>
                  </div>
                  <div className="modal-body">
                    <div className="settings-table">
                        <div className="settings-links">
                            <SettingsSidebar
                                tabs={tabs}
                                activeTab={this.state.active_tab}
                                updateTab={this.updateTab}
                            />
                        </div>
                        <div className="settings-content">
                            <TeamSettings
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

