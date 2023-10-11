import React from 'react';
import './separator.scss';
import './notification-separator.scss';

function NotificationSeparator({ children }: React.PropsWithChildren<any>) {
  return (
    <div className='Separator NotificationSeparator' data-testid='NotificationSeparator'>
      <hr className='separator__hr' />
      {children && (
        <div className='separator__text'>{children}</div>
      )}
    </div>
  );
}
export default NotificationSeparator;
