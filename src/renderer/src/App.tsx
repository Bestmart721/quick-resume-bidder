import Versions from './components/Versions'
import { useEffect, useRef, useState } from 'react'
import { GripVerticalIcon } from 'lucide-react'
let i = 0;

export interface LogType {
  id?: number
  text: string,
  type?: string,
}

function App(): JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  const [logArray, setLogArray] = useState<LogType[]>([{
    text: 'Welcome to Quick Resume!',
    type: 'info',
    id: i
  }])
  const logAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electron.ipcRenderer.on('message', (event, arg) => {
      setLogArray((prev) => {
        const newArray = [...prev, {
          text: arg.text,
          type: arg.type,
          id: i
        }]
        // return newArray.slice(-20)
        return newArray
      })
    })

    return () => {
      window.electron.ipcRenderer.removeAllListeners('message')
    }
  }, [])

  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight
    }
  }, [logArray])

  return (
    <>
      <div className="bg"></div>
      <GripVerticalIcon className='move-icon' />
      <div className='log-area' ref={logAreaRef}>
        {
          logArray.map((log, index) => (
            <div key={index}
              style={{
                color: (() => {
                  if (log.type?.includes('error')) return 'pink'
                  if (log.type?.includes('warning')) return 'yellow'
                  if (log.type?.includes('info')) return 'cyan'
                  if (log.type?.includes('success')) return 'lightgreen'
                  return 'white'
                })()
              }}
            >{log.text}</div>
          ))
        }
      </div>
    </>
  )
}

export default App
