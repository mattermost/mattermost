// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    edit: {
        id: 'setting_item_min.edit',
        defaultMessage: 'Edit'
    }
});

class SettingItemMin extends React.Component {
    render() {
        const {formatMessage} = this.props.intl;
        let editButton = null;
        if (!this.props.disableOpen) {
            editButton = (
                <li className='col-sm-2 section-edit'>
                    <a
                        className='section-edit theme'
                        href='#'
                        onClick={this.props.updateSection}
                    >
                        <i className='fa fa-pencil'/>
                        {formatMessage(messages.edit)}
                    </a>
                </li>
            );
        }

        return (
            <ul
                className='section-min'
                onClick={this.props.updateSection}
            >
                <li className='col-sm-10 section-title'>{this.props.title}</li>
                {editButton}
                <li className='col-sm-7 section-describe'>{this.props.describe}</li>
            </ul>
        );
    }
}

SettingItemMin.propTypes = {
    intl: intlShape.isRequired,
    title: React.PropTypes.string,
    disableOpen: React.PropTypes.bool,
    updateSection: React.PropTypes.func,
    describe: React.PropTypes.string
};

export default injectIntl(SettingItemMin);