import {FormattedMessage} from "react-intl";
import React from "react";

const WarningTextSection = (): JSX.Element => {
    return (
        <div className='warning-section'>
            <i className='fa fa-exclamation-circle'/>
            <div className='warning-text'>
                <div className='warning-header'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_modal.warning_header'
                        defaultMessage='Conversation history will be visible to any channel members'
                    />
                </div>
                <div className='warning-body'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_modal.warning_body'
                        defaultMessage='You are about to convert the Group Message with Tim Thomas and John James to a Channel. This cannot be undone.'
                    />
                </div>
            </div>
        </div>
    )
}
export default WarningTextSection;
