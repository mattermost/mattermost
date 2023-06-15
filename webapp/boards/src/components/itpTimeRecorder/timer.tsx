export class Timer {
    private timerValue: number = 0;
    private intervalId: NodeJS.Timeout | null = null;
  
    public startTimer() {
      this.intervalId = setInterval(() => {
        this.timerValue += 1;
      }, 1000);
    }
  
    public stopTimer() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  
    public getTimerValue() {
      return this.timerValue;
    }
  }
  
  export const timer = new Timer();