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
                            {formatMessage({ id: 'admin.ip_filtering.enable_ip_filtering_description', defaultMessage: 'Enable IP Filtering to limit access to your workspace by IP addresses.' })}
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