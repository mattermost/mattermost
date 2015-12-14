// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
var Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    selectTeam: {
        id: 'admin.select_team.selectTeam',
        defaultMessage: 'Select Team'
    },
    select: {
        id: 'admin.select_team.select',
        defaultMessage: 'Select'
    },
    close: {
        id: 'admin.select_team.close',
        defaultMessage: 'Close'
    }
});

class SelectTeamModal extends React.Component {
    constructor(props) {
        super(props);

        this.doSubmit = this.doSubmit.bind(this);
        this.doCancel = this.doCancel.bind(this);
    }

    doSubmit(e) {
        e.preventDefault();
        this.props.onModalSubmit(ReactDOM.findDOMNode(this.refs.team).value);
    }
    doCancel() {
        this.props.onModalDismissed();
    }
    render() {
        const {formatMessage} = this.props.intl;
        if (this.props.teams == null) {
            return <div/>;
        }

        var options = [];

        for (var key in this.props.teams) {
            if (this.props.teams.hasOwnProperty(key)) {
                var team = this.props.teams[key];
                options.push(
                    <option
                        key={'opt_' + team.id}
                        value={team.id}
                    >
                        {team.name}
                    </option>
                );
            }
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.doCancel}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{formatMessage(messages.selectTeam)}</Modal.Title>
                </Modal.Header>
                <form
                    role='form'
                    className='form-horizontal'
                >
                    <Modal.Body>
                        <div className='form-group'>
                            <div className='col-sm-12'>
                                <select
                                    ref='team'
                                    size='10'
                                    className='form-control'
                                >
                                    {options}
                                </select>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.doCancel}
                        >
                            {formatMessage(messages.close)}
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                            tabIndex='2'
                        >
                            {formatMessage(messages.select)}
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

SelectTeamModal.defaultProps = {
    show: false
};

SelectTeamModal.propTypes = {
    intl: intlShape.isRequired,
    teams: React.PropTypes.object,
    show: React.PropTypes.bool.isRequired,
    onModalSubmit: React.PropTypes.func,
    onModalDismissed: React.PropTypes.func
};

export default injectIntl(SelectTeamModal);