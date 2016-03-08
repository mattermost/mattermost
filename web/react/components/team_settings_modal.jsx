// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingsSidebar from './settings_sidebar.jsx';
import TeamSettings from './team_settings.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    generalTab: {
        id: 'team_settings_modal.generalTab',
        defaultMessage: 'General'
    },
    importTab: {
        id: 'team_settings_modal.importTab',
        defaultMessage: 'Import'
    },
    exportTab: {
        id: 'team_settings_modal.exportTab',
        defaultMessage: 'Export'
    }
});

class TeamSettingsModal extends React.Component {
    constructor(props) {
        super(props);

        this.updateTab = this.updateTab.bind(this);
        this.updateSection = this.updateSection.bind(this);

        this.state = {
            activeTab: 'general',
            activeSection: ''
        };
    }
    componentDidMount() {
        const modal = $(ReactDOM.findDOMNode(this.refs.modal));

        modal.on('click', '.modal-back', function handleBackClick() {
            $(this).closest('.modal-dialog').removeClass('display--content');
            $(this).closest('.modal-dialog').find('.settings-table .nav li.active').removeClass('active');
        });
        modal.on('click', '.modal-header .close', () => {
            setTimeout(() => {
                $('.modal-dialog.display--content').removeClass('display--content');
            }, 500);
        });
    }
    updateTab(tab) {
        this.setState({activeTab: tab, activeSection: ''});
    }
    updateSection(section) {
        this.setState({activeSection: section});
    }
    render() {
        const {formatMessage} = this.props.intl;
        const tabs = [];
        tabs.push({name: 'general', uiName: formatMessage(holders.generalTab), icon: 'glyphicon glyphicon-cog'});
        tabs.push({name: 'import', uiName: formatMessage(holders.importTab), icon: 'glyphicon glyphicon-upload'});

        // To enable export uncomment this line
        //tabs.push({name: 'export', uiName: formatMessage(holders.exportTab), icon: 'glyphicon glyphicon-download'});

        return (
            <div
                className='modal fade'
                ref='modal'
                id='team_settings'
                role='dialog'
                tabIndex='-1'
                aria-hidden='true'
            >
                <div className='modal-dialog settings-modal'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                                aria-label='Close'
                            >
                                <span aria-hidden='true'>&times;</span>
                            </button>
                            <h4
                                className='modal-title'
                                ref='title'
                            >
                                <FormattedMessage
                                    id='team_settings_modal.title'
                                    defaultMessage='Team Settings'
                                />
                            </h4>
                        </div>
                        <div className='modal-body settings-modal__body'>
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
}

TeamSettingsModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(TeamSettingsModal);