import React from 'react';

import './typing_indicator.scss';

const TypingIndicator = () => {
    return (
        <div className='typing-indicator'>
            <div className='typing-indicator__dot' />
            <div className='typing-indicator__dot' />
            <div className='typing-indicator__dot' />
        </div>
    );
};

export default TypingIndicator;
