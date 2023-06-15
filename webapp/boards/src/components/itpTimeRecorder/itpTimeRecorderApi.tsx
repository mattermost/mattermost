interface timeRecord {
    uId: string;
    boardId: string;
    datetime: string;
    taskId: string;
    taskStatus: boolean;
  }

export const fetchTimeRecord = async () => {
    try {
        const response = await fetch('/api/time/record');
        const data = await response.json();
        return data;
    } catch (error) {
        console.log('Error fetching records:', error);
    }
};
    
export const AddTimeRecord = async (timeRecord:timeRecord) => {
    try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(timeRecord),
        });
    
        if (!response.ok) {
          throw new Error('Error creating user: ' + response.statusText);
        }
      } catch (error:any) {
        throw new Error('Error creating user: ' + error.message);
      }
};
    
export const deleteTimeRecord = async (userId: number) => {
    try {
        const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        });

        if (response.ok) {
            //do something
        } else {
        console.log('Error deleting user:', response.statusText);
        }
    } catch (error) {
        console.log('Error deleting user:', error);
    }
};

