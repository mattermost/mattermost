// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import ManageLanguages from './manage_languages.jsx';

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
                <ManageLanguages
                    user={this.props.user}
                    key='languages-ui'
                />
            );

            languagesSection = (
                <SettingItemMax
                    title={formatMessage(messages.name)}
                    width='medium'
                    inputs={inputs}
                    updateSection={(e) => {
                            this.updateSection('');
                            e.preventDefault();
                        }}
                />
            );
        } else {
            languagesSection = (
                <SettingItemMin
                    title={formatMessage(messages.name)}
                    width='medium'
                    describe={formatMessage(messages.description)}
                    updateSection={() => {
                            this.updateSection('languages');
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
    activeSection: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(UserSettingsLanguageTab);
