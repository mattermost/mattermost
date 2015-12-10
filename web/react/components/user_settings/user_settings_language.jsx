// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('../setting_item_min.jsx');
var SettingItemMax = require('../setting_item_max.jsx');
var ManageLangauges = require('./manage_languages.jsx');
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    name: {
        id: 'user.settings.languages.name',
        defaultMessage: 'Language'
    },
    description: {
        id: 'user.settings.languages.description',
        defaultMessage: 'Manage the language in which the chat is shown'
    },
    title: {
        id: 'user.settings.languages.title',
        defaultMessage: 'Language Settings'
    },
    close: {
        id: 'user.settings.languages.close',
        defaultMessage: 'Close'
    }
});

class UserSettingsLanguageTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);

        this.state = {};
    }
    updateSection(section) {
        this.props.updateSection(section);
    }
    render() {
        const {formatMessage} = this.props.intl;
        let languagesSection;
        var inputs = [];

        if (this.props.activeSection === 'languages') {
            inputs.push(
                <ManageLangauges
                    user={this.props.user}
                    key='languages'
                />
            );

            languagesSection = (
                <SettingItemMax
                    title={formatMessage(messages.name)}
                    inputs={inputs}
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                />
            );
        } else {
            languagesSection = (
                <SettingItemMin
                    title={formatMessage(messages.name)}
                    describe={formatMessage(messages.description)}
                    updateSection={function updateNameSection() {
                        this.updateSection('languages');
                    }.bind(this)}
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
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
                        {formatMessage(messages.title)}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{formatMessage(messages.title)}</h3>
                    <div className='divider-dark first'/>
                    {languagesSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

UserSettingsLanguageTab.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string
};

export default injectIntl(UserSettingsLanguageTab);