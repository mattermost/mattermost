// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingsSidebar = require('./settings_sidebar.jsx');
var TeamSettings = require('./team_settings.jsx');

module.exports = React.createClass({
    displayName: 'Team Settings Modal',
    componentDidMount: function() {
        $('body').on('click', '.modal-back', function onClick() {
            $(this).closest('.modal-dialog').removeClass('display--content');
        });
        $('body').on('click', '.modal-header .close', function onClick() {
            setTimeout(function removeContent() {
                $('.modal-dialog.display--content').removeClass('display--content');
            }, 500);
        });
    },
    updateTab: function(tab) {
        this.setState({activeTab: tab});
    },
    updateSection: function(section) {
        this.setState({activeSection: section});
    },
    getInitialState: function() {
        return {activeTab: 'feature', activeSection: ''};
    },
    render: function() {
        var tabs = [];
        tabs.push({name: 'feature', uiName: 'Features', icon: 'glyphicon glyphicon-wrench'});
        tabs.push({name: 'import', uiName: 'Import', icon: 'glyphicon glyphicon-upload'});

        return (
            <div className='modal fade' ref='modal' id='team_settings' role='dialog' tabIndex='-1' aria-hidden='true'>
              <div className='modal-dialog settings-modal'>
                <div className='modal-content'>
                  <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'>Team Settings</h4>
                  </div>
                  <div className='modal-body'>
                    <div className='settings-table'>
                        <div className='settings-links'>
                            <SettingsSidebar
                                tabs={tabs}
                                activeTab={this.state.activeTab}
                                updateTab={this.updateTab}
                            />
                        </div>
                        <div className='settings-content minimize-settings'>
                            <TeamSettings
                                activeTab={this.state.activeTab}
                                activeSection={this.state.activeSection}
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

