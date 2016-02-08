// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import * as GlobalActions from '../../action_creators/global_actions.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    applicationsPreview: {
        id: 'user.settings.developer.applicationsPreview',
        defaultMessage: 'Applications (Preview)'
    },
    thirdParty: {
        id: 'user.settings.developer.thirdParty',
        defaultMessage: 'Open to register a new third-party application'
    }
});

class DeveloperTab extends React.Component {
    constructor(props) {
        super(props);

        this.register = this.register.bind(this);

        this.state = {};
    }
    register() {
        this.props.closeModal();
        GlobalActions.showRegisterAppModal();
    }
    render() {
        var appSection;
        var self = this;
        const {formatMessage} = this.props.intl;
        if (this.props.activeSection === 'app') {
            var inputs = [];

            inputs.push(
                <div
                    key='registerbtn'
                    className='form-group'
                >
                    <div className='col-sm-7'>
                        <a
                            className='btn btn-sm btn-primary'
                            onClick={this.register}
                        >
                            <FormattedMessage
                                id='user.settings.developer.register'
                                defaultMessage='Register New Application'
                            />
                        </a>
                    </div>
                </div>
            );

            appSection = (
                <SettingItemMax
                    title={formatMessage(holders.applicationsPreview)}
                    inputs={inputs}
                    updateSection={function updateSection(e) {
                        self.props.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            appSection = (
                <SettingItemMin
                    title={formatMessage(holders.applicationsPreview)}
                    describe={formatMessage(holders.thirdParty)}
                    updateSection={function updateSection() {
                        self.props.updateSection('app');
                    }}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i
                                className='fa fa-angle-left'
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.developer.title'
                            defaultMessage='Developer Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.developer.title'
                            defaultMessage='Developer Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {appSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

DeveloperTab.defaultProps = {
    activeSection: ''
};
DeveloperTab.propTypes = {
    intl: intlShape.isRequired,
    activeSection: React.PropTypes.string,
    updateSection: React.PropTypes.func,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(DeveloperTab);