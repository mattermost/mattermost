import React from 'react';
import PropTypes from 'prop-types';
import {FormattedDate} from 'react-intl';

export default class DateSeparator extends React.PureComponent {
    static propTypes = {

        /*
         * The date to display in the separator
         */
        date: PropTypes.instanceOf(Date)
    }

    render() {
        return (
            <div
                className='date-separator'
            >
                <hr className='separator__hr'/>
                <div className='separator__text'>
                    <FormattedDate
                        value={this.props.date}
                        weekday='short'
                        month='short'
                        day='2-digit'
                        year='numeric'
                    />
                </div>
            </div>
        );
    }
}
