import React, { useEffect, useRef, useState } from 'react'
import {Board} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {IUser} from 'src/user'
import {getMe} from 'src/store/users'

import './itpTimeRecorder.scss'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {getTrigger, setTrigger} from 'src/store/itpTimeRecorderStore'
import { fetchTimeRecord,AddTimeRecord,deleteTimeRecord  } from './itpTimeRecorderApi';
interface Props {
    board: Board,
    card: Card
}

const ItpTimeRecorder = ({ board, card }: Props) => {
    
   
    const storedValueTime = localStorage.getItem('ongoingTaskTime');
    let storedtimelocal = '';
    if(storedValueTime !== null){
        storedtimelocal = storedValueTime
    }
    const storedValue = localStorage.getItem('ongoingTask');
    const retrievedValue = storedValue ? JSON.parse(storedValue) : false;

    const me = useAppSelector<IUser|null>(getMe);
    const istrigger = useAppSelector<boolean>(getTrigger);
    const [isShown, setIsShown] = useState(false);
    const [isStart, setIsStart] = useState(retrievedValue);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [time, setTime] = useState(storedtimelocal);
    const [stoppedTime, setStoppedTime] = useState('00h 00m');
    const dispatch = useAppDispatch()


   
    
    useEffect(() => {

        let storedValuelocal = false;
        // if(storedValue !== null){
        //     storedValuelocal = Boolean(storedValue)
        //     setIsStart(storedValuelocal)
        // }
       
        if(retrievedValue){
            handleStart()
        }

        // console.log(isStart);
        // setIsStart(false);
        
        //check local storage first
        // setTime('02:03:02');
        // console.log(storedValuelocal);
        // console.log(isStart);
        // if(isStart){
        //     handleStart();
        // }
        

      }, []); // Empty dependency array to run only once on mount
    

    const handleStart = () => {

        const [hours, minutes, seconds] = time.split(':').map(Number);
        let totalSeconds = hours * 3600 + minutes * 60 + seconds;
    
        const interval = setInterval(() => {
          totalSeconds++;
    
          const updatedHours = Math.floor(totalSeconds / 3600);
          const updatedMinutes = Math.floor((totalSeconds % 3600) / 60);
          const updatedSeconds = totalSeconds % 60;

          let newTime = `${String(updatedHours).padStart(2, '0')}:${String(updatedMinutes).padStart(2, '0')}:${String(
            updatedSeconds
          ).padStart(2, '0')}`;

        //   localStorage.setItem('ongoingTaskTime', newTime)
          setTime(newTime);


        
        }, 1000);
    
        setIntervalId(interval);
        dispatch(setTrigger(true))
        setIsStart(true);

        sendTimeToServer('start');

        console.log(interval);
      };


      //when refresh- 
      //have to get data from api
      
    const handleStop = () => {
        
        if (intervalId) {
            const [hours, minutes, seconds] = time.split(':').map(Number);
            let totalSeconds = hours * 3600 + minutes * 60 + seconds;
            const updatedHours = Math.floor(totalSeconds / 3600);
            const updatedMinutes = Math.floor((totalSeconds % 3600) / 60);

            clearInterval(intervalId);
            setIntervalId(null);
            setStoppedTime(
            `${String(updatedHours).padStart(2, '0')}h ${String(updatedMinutes).padStart(2, '0')}m`
            );
            setIsStart(false);
           
            sendTimeToServer('stop');

            dispatch(setTrigger(false))
            localStorage.setItem('ongoingTaskTime', time)

          }
    }

    const sendTimeToServer = (option:string) => {

        if (me !== null) {

            let cardId = card.id;
            let boardId = board.id;
            let userId = me.id;
            let timecount = time;
            let status = option;

          } else {

            console.log("User 'me' is null");
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