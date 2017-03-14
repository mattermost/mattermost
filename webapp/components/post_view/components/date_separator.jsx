import React from 'react';
import {FormattedDate} from 'react-intl';

export default class DateSeparator extends React.Component {
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

DateSeparator.propTypes = {
    date: React.PropTypes.instanceOf(Date)
};
