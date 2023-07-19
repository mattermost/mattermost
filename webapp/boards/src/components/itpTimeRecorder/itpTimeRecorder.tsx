import React, { useEffect, useState } from 'react'

import {Board} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {IUser} from 'src/user'
import {getMe} from 'src/store/users'

import './itpTimeRecorder.scss'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
// import {getTrigger, setTrigger} from 'src/store/itpTimeRecorderStore'
interface Props {
    board: Board,
    card: Card
}

interface taskObject {
    mm_user_id?: string;
    user_name?: string;
    u_email?: string;
    mm_project_id?: string;
    p_name?: string;
    mm_activity_id?: string;
    a_name?: string;
    action: string;
  }

const ItpTimeRecorder = ({ board, card }: Props) => {
    
    const me = useAppSelector<IUser|null>(getMe);
    // const istrigger = useAppSelector<boolean>(getTrigger);
    const [isShown, setIsShown] = useState(false);
    const [isStart, setIsStart] = useState(false);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [time, setTime] = useState('00:00:00');
    const [taskStatus, setTaskStatus] = useState(true);
    const [stoppedTime, setStoppedTime] = useState('00h 00m');
    const [rowTime, setRowTime] = useState(0);
    // const dispatch = useAppDispatch()

    const fetchTaskStatus = async () => {

        let userid = me?.id;
        let usename = me?.username;
        let email = `${me?.username}@itplace.com`;
        let projectid = board?.id;
        let projectname = board?.title;
        let taskid = card?.id;
        let taskname = card?.title;
        
        let obj: taskObject = {
            mm_user_id: userid,
            user_name: usename,
            u_email: email,
            mm_project_id: projectid,
            p_name: projectname,
            mm_activity_id: taskid,
            a_name: taskname,
            action: 'status',
        };
        
        try {
            const response = await fetch('http://mm2kimai-staging.itplace.io/timerecord', {
            method: 'POST',
            body: JSON.stringify(obj),
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
            },
            });
            const data = await response.json();
        
            if (data.data.length === 0) {
            setIsStart(false);
            setTaskStatus(true);
            } else {
            if (data.data.status === null) {
                let time = getIntiatTime(data.data.begin_time);
                setTime(timeFormatSeconds(time));
                setIsStart(true);
                setTaskStatus(true);
                let interval = runTimer(time);
                setIntervalId(interval);
                // dispatch(setTrigger(true));
            } else if (data.data.status === 'stop') {
                setIsStart(false);
                setTaskStatus(false);
            }
        
            setStoppedTime(timeFormat(data.time));
            setRowTime(data.time);
            }
        } catch (err: any) {
            console.log(err.message);
        }
    };
          
    useEffect(() => {
    fetchTaskStatus();
    }, []);

    const handleStart = () => {

        let userid = me?.id;
        let usename = me?.username;
        let email = me?.username + '@itplace.com';
        let projectid = board?.id;
        let projectname = board?.title;
        let taskid = card?.id;
        let taskname = card?.title;
      
        let obj: taskObject = {
          mm_user_id: userid,
          user_name: usename,
          u_email: email,
          mm_project_id: projectid,
          p_name: projectname,
          mm_activity_id: taskid,
          a_name: taskname,
          action: taskStatus ? 'create' : 'restart',
        };
      
        handleStartOrRestart(obj);
      
        const [hours, minutes, seconds] = time.split(':').map(Number);
        let totalSeconds = hours * 3600 + minutes * 60 + seconds;
        let interval = runTimer(totalSeconds);
      
        setIntervalId(interval);
        // dispatch(setTrigger(true));
        setIsStart(true);

    };

    const handleStartOrRestart = (obj: taskObject) => {
        
          fetch('http://mm2kimai-staging.itplace.io/timerecord', {
            method: 'POST',
            body: JSON.stringify(obj),
            headers: {
              'Content-type': 'application/json; charset=UTF-8',
            },
          })
            .then((response) => response.json())
            .catch((err) => {
              console.log(err.message);
        });
    };

    const timeFormat = (seconds:number) => {

        const updatedHours = Math.floor(seconds / 3600);
        const updatedMinutes = Math.ceil((seconds % 3600) / 60);

        return `${String(updatedHours).padStart(2, '0')}h ${String(updatedMinutes).padStart(2, '0')}m`;

    }

    const timeFormatSeconds = (seconds:number) => {

        const updatedHours = Math.floor(seconds / 3600);
        const updatedMinutes = Math.floor((seconds % 3600) / 60);
        const updatedSeconds = seconds % 60;

        let newTime = `${String(updatedHours).padStart(2, '0')}:${String(updatedMinutes).padStart(2, '0')}:${String(
        updatedSeconds
        ).padStart(2, '0')}`;

        return newTime;

    }

    const getIntiatTime = (dt:string) => {

        const specificDateTime: Date = new Date(dt);
        const currentTime: Date = new Date();
        const differenceInSeconds: number = Math.floor((currentTime.getTime() - specificDateTime.getTime()) / 1000);

        return differenceInSeconds;
    }

    const runTimer = (totalSeconds:number,) => {

        const interval = setInterval(() => {
            totalSeconds++;
            let newTime = timeFormatSeconds(totalSeconds);
            setTime(newTime);
          
        }, 1000);

          return interval;
    }

    const handleStop = () => {

        let userid = me?.id;
        let usename = me?.username;
        let email = me?.username+'@itplace.com';
        let projectid = board?.id;
        let projectname = board?.title;
        let taskid = card?.id;
        let taskname = card?.title;

        let obj: taskObject = {
            mm_user_id: userid,
            user_name: usename,
            u_email: email,
            mm_project_id: projectid,
            p_name: projectname,
            mm_activity_id: taskid,
            a_name: taskname,
            action: 'stop',
        };

        fetch('http://mm2kimai-staging.itplace.io/timerecord',{
                method: 'POST',
                body: JSON.stringify(obj),
                headers: {
                    'Content-type': 'application/json; charset=UTF-8',
                },
             })
            .then((response)=> response.json())
            .then((data)=>{

                if(data.data.status === 'stop'){
                    setIsStart(false);
                    setRowTime(data.time);
                }
            })
            .catch((err) => {
                console.log(err.message);
            });
        
        if (intervalId) {

            const [hours, minutes, seconds] = time.split(':').map(Number);
            let totalSecondstot = rowTime;
            let totalSeconds = hours * 3600 + minutes * 60 + seconds;
            let timesum = (totalSeconds + totalSecondstot);
            const updatedHours = Math.floor(timesum / 3600);
            const updatedMinutes = Math.ceil((timesum % 3600) / 60);

            clearInterval(intervalId);
            setIntervalId(null);

            setStoppedTime(
            `${String(updatedHours).padStart(2, '0')}h ${String(updatedMinutes).padStart(2, '0')}m`
            );

            setIsStart(false);

            // dispatch(setTrigger(false))

            setTime('00:00:00');

          }
    }

    const handleStopTimeHover = (e:any) => {
        setIsShown(true)
    }

    const handleStopBtnHover = (e:any) => {
        setIsShown(false)
    }
    
    return (
            <div className="parent">
                <div className="child">
                    { !isStart && (
                        <button className='Button emphasis--primary startBtn size--medium' onClick={handleStart}><i className="CompassIcon icon-play"></i>Start Recording</button>
                    )}

                    {isStart && (
                        <button className='Button stopBtn emphasis--primary size--medium' onClick={handleStop}  onMouseOver={handleStopTimeHover} onMouseLeave={handleStopBtnHover}>

                            {!isShown && (
                                <span >{time}</span>
                            )}
                            {isShown && (
                                <span  >Stop</span>
                            )}
                        </button>

                    )}
                </div>

                <div className="child">
                    <span className='totalTime'>Total: {stoppedTime} </span>
                </div>
            </div>
    )
}

export default ItpTimeRecorder;