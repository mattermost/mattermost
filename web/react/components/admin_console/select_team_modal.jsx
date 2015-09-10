// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class SelectTeam extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    render() {
        return (
            <div className='modal fade'
                id='select-team'
                tabIndex='-1'
                role='dialog'
                aria-labelledby='teamsModalLabel'
            >
                <div className='modal-dialog'
                    role='document'
                >
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
                                id='teamsModalLabel'
                            >
                                {'Select a team'}
                            </h4>
                        </div>
                        <div className='modal-body'>
                            <table className='more-channel-table table'>
                                <tbody>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Descartes'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Grouping'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Adventure'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Crossroads'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Sky scraping'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Outdoors'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Microsoft'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <p className='more-channel-name'>{'Apple'}</p>
                                        </td>
                                        <td className='td--action'>
                                            <button className='btn btn-primary'>{'Join'}</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >
                                {'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}