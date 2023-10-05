import React from 'react';
import { useIntl } from 'react-intl';
import Toggle from 'components/toggle';

type Props = {
    filterToggle: boolean;
    setFilterToggle: (value: boolean) => void;
};

const EnableSectionContent: React.FC<Props> = ({ filterToggle, setFilterToggle }) => {
    const { formatMessage } = useIntl();

    return (
        <div className="EnableSectionContent">
            <div className="Frame1281">
                <div className="TitleSubtitle">
                    <div className="Frame1286">
                        <div className="Title">
                            {formatMessage({ id: 'admin.ip_filtering.enable_ip_filtering', defaultMessage: 'Enable IP Filtering' })}
                        </div>
                        <div className="Subtitle">
                            {formatMessage({ id: 'admin.ip_filtering.enable_ip_filtering_description', defaultMessage: 'Limit access to your workspace by IP address. {learnmore}' }, {learnmore: (<a href="https://docs.mattermost.com/deployment/ip-address-filtering.html" target="_blank">{formatMessage({ id: 'admin.ip_filtering.learn_more', defaultMessage: 'Learn more in the docs' })}</a>)})}
                        </div>
                    </div>
                </div>
                <div className="SwitchSelector">
                    <Toggle
                        size={'btn-md'}
                        id={'filterToggle'}
                        disabled={false}
                        onToggle={() => setFilterToggle(!filterToggle)}
                        toggled={filterToggle}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>
        </div>
    );
};

export default EnableSectionContent;