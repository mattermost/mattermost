// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../../utils/utils.jsx';
import * as Client from '../../../utils/client.jsx';
import Constants from '../../../utils/constants.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const holders = defineMessages({
    required: {
        id: 'team_signup_url.required',
        defaultMessage: 'This field is required'
    },
    regex: {
        id: 'team_signup_url.regex',
        defaultMessage: "Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash."
    },
    charLength: {
        id: 'team_signup_url.charLength',
        defaultMessage: 'Name must be 4 or more characters up to a maximum of 15'
    },
    taken: {
        id: 'team_signup_url.taken',
        defaultMessage: 'URL is taken or contains a reserved word'
    },
    unavailable: {
        id: 'team_signup_url.unavailable',
        defaultMessage: 'This URL is unavailable. Please try another.'
    }
});

class TeamSignupUrlPage extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);
        this.handleFocus = this.handleFocus.bind(this);

        this.state = {nameError: ''};
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'team_display_name';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        const name = ReactDOM.findDOMNode(this.refs.name).value.trim();
        if (!name) {
            this.setState({nameError: formatMessage(holders.required)});
            return;
        }

        const cleanedName = Utils.cleanUpUrlable(name);

        const urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;
        if (cleanedName !== name || !urlRegex.test(name)) {
            this.setState({nameError: formatMessage(holders.regex)});
            return;
        } else if (cleanedName.length < 4 || cleanedName.length > 15) {
            this.setState({nameError: formatMessage(holders.charLength)});
            return;
        }

        if (global.window.mm_config.RestrictTeamNames === 'true') {
            for (let index = 0; index < Constants.RESERVED_TEAM_NAMES.length; index++) {
                if (cleanedName.indexOf(Constants.RESERVED_TEAM_NAMES[index]) === 0) {
                    this.setState({nameError: formatMessage(holders.taken)});
                    return;
                }
            }
        }

        Client.findTeamByName(name,
              (data) => {
                  if (data) {
                      this.setState({nameError: formatMessage(holders.unavailable)});
                  } else {
                      if (global.window.mm_config.SendEmailNotifications === 'true') {
                          this.props.state.wizard = 'send_invites';
                      } else {
                          this.props.state.wizard = 'username';
                      }
                      this.props.state.team.type = 'O';

                      this.props.state.team.name = name;
                      this.props.updateParent(this.props.state);
                  }
              },
              (err) => {
                  this.setState({nameError: err.message});
              }
        );
    }
    handleFocus(e) {
        e.preventDefault();

        e.currentTarget.select();
    }
    render() {
        $('body').tooltip({selector: '[data-toggle=tooltip]', trigger: 'hover click'});

        Client.track('signup', 'signup_team_03_url');

        let nameError = null;
        let nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        const title = `${Utils.getWindowLocationOrigin()}/`;

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h2>
                        <FormattedMessage
                            id='team_signup_url.teamUrl'
                            defaultMessage='Team URL'
                        />
                    </h2>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-11'>
                                <div className='input-group input-group--limit'>
                                    <span
                                        data-toggle='tooltip'
                                        title={title}
                                        className='input-group-addon'
                                    >
                                        {title}
                                    </span>
                                    <input
                                        type='text'
                                        ref='name'
                                        className='form-control'
                                        placeholder=''
                                        maxLength='128'
                                        defaultValue={this.props.state.team.name}
                                        autoFocus={true}
                                        onFocus={this.handleFocus}
                                        spellCheck='false'
                                    />
                                </div>
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <p>
                        <FormattedMessage
                            id='team_signup_url.webAddress'
                            defaultMessage='Choose the web address of your new team:'
                        />
                    </p>
                    <ul className='color--light'>
                        <FormattedHTMLMessage
                            id='team_signup_url.hint'
                            defaultMessage="<li>Short and memorable is best</li>
                            <li>Use lowercase letters, numbers and dashes</li>
                            <li>Must start with a letter and can't end in a dash</li>"
                        />
                    </ul>
                    <button
                        type='submit'
                        className='btn btn-primary margin--extra'
                        onClick={this.submitNext}
                    >
                        <FormattedMessage
                            id='team_signup_url.next'
                            defaultMessage='Next'
                        /><i className='glyphicon glyphicon-chevron-right'></i>
                    </button>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            <FormattedMessage
                                id='team_signup_url.back'
                                defaultMessage='Back to previous step'
                            />
                        </a>
                    </div>
                </form>
            </div>
        );
    }
}

TeamSignupUrlPage.propTypes = {
    intl: intlShape.isRequired,
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};

export default injectIntl(TeamSignupUrlPage);
