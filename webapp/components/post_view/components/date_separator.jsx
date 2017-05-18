import PropTypes from 'prop-types';
import React from 'react';
import {FormattedDate} from 'react-intl';

export default function DateSeparator(props) {
    return (
        <div
            className='date-separator'
        >
            <hr className='separator__hr'/>
            <div className='separator__text'>
                <FormattedDate
                    value={props.date}
                    weekday='short'
                    month='short'
                    day='2-digit'
                    year='numeric'
                />
            </div>
        </div>
    );
}

DateSeparator.propTypes = {
    date: PropTypes.instanceOf(Date)
};
