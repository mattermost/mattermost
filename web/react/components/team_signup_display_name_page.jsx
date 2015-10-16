// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');

export default class TeamSignupDisplayNamePage extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);

        this.state = {};
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'welcome';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        var displayName = ReactDOM.findDOMNode(this.refs.name).value.trim();
        if (!displayName) {
            this.setState({nameError: 'This field is required'});
            return;
        }

        this.props.state.wizard = 'team_url';
        this.props.state.team.display_name = displayName;
        this.props.state.team.name = utils.cleanUpUrlable(displayName);
        this.props.updateParent(this.props.state);
    }
    handleFocus(e) {
        e.preventDefault();
        e.currentTarget.select();
    }
    render() {
        client.track('signup', 'signup_team_02_name');

        var nameError = null;
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h2>{'Team Name'}</h2>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <input
                                    type='text'
                                    ref='name'
                                    className='form-control'
                                    placeholder=''
                                    maxLength='128'
                                    defaultValue={this.props.state.team.display_name}
                                    autoFocus={true}
                                    onFocus={this.handleFocus}
                                    spellCheck='false'
                                />
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <div>
                        {'Name your team in any language. Your team name shows in menus and headings.'}
                    </div>
                    <button
                        type='submit'
                        className='btn btn-primary margin--extra'
                        onClick={this.submitNext}
                    >
                        Next<i className='glyphicon glyphicon-chevron-right'></i>
                    </button>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            Back to previous step
                        </a>
                    </div>
                </form>
            </div>
        );
    }
}

TeamSignupDisplayNamePage.propTypes = {
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};
