import React, { useEffect, useState } from 'react'
import './itpTimeRecorder.scss'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {getTrigger, setTrigger} from 'src/store/itpTimeRecorderStore'


interface Props {
    board: String
}

const ItpTimeViewer = ({ board }: Props)  => {
  
  const storedValue = localStorage.getItem('ongoingTask');

  const retrievedValue = storedValue ? JSON.parse(storedValue) : false;
  
  const istrigger = useAppSelector<boolean>(getTrigger);
  const [isShown, setIsShown] = useState(retrievedValue);
  



useEffect(() => {

  console.log(retrievedValue+'---'+istrigger);
  if (retrievedValue && istrigger === null || retrievedValue && istrigger || retrievedValue && !istrigger  ) {
      
      setIsShown(true);


    }else{
      setIsShown(false);
    }
  
}, [istrigger]);


      return (
        
          <div >
            {isShown && (
            <div ><i className="CompassIcon icon-clock"></i> 00:00:00 <button className='stopBtnMenu size--medium'><i className="CompassIcon icon-square"></i></button></div>
            )}
          </div>
      
      )
}


export default ItpTimeViewer