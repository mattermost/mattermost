// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import * as EventHelpers from '../../dispatcher/event_helpers.jsx';

const messages = defineMessages({
    register: {
        id: 'user.settings.developer.register',
        defaultMessage: 'Register New Application'
    },
    applicationsPreview: {
        id: 'user.settings.developer.applicationsPreview',
        defaultMessage: 'Applications (Preview)'
    },
    thirdParty: {
        id: 'user.settings.developer.thirdParty',
        defaultMessage: 'Open to register a new third-party application'
    },
    title: {
        id: 'user.settings.developer.title',
        defaultMessage: 'Developer Settings'
    },
    close: {
        id: 'user.settings.developer.close',
        defaultMessage: 'Close'
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
        EventHelpers.showRegisterAppModal();
    }
    render() {
        const {formatMessage} = this.props.intl;
        var appSection;
        var self = this;
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
                            {formatMessage(messages.register)}
                        </a>
                    </div>
                </div>
            );

            appSection = (
                <SettingItemMax
                    title={formatMessage(messages.applicationsPreview)}
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
                    title={formatMessage(messages.applicationsPreview)}
                    describe={formatMessage(messages.thirdParty)}
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
                        aria-label={formatMessage(messages.close)}
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i
                            className='modal-back'
                            onClick={this.props.collapseModal}
                        />
                        {formatMessage(messages.title)}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{formatMessage(messages.title)}</h3>
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