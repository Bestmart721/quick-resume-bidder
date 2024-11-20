/* eslint-disable @typescript-eslint/explicit-function-return-type */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { app, shell, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, screen } from 'electron'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import OpenAI from 'openai'
import { z as zod } from 'zod'
import fs from 'fs'
import path from 'path'
import { getText } from '@one-lang/get-selected-text'
import { GlobalKeyboardListener } from 'node-global-key-listener'
import PizZip from 'pizzip'
import { exec } from 'child_process'
import { zodResponseFormat } from 'openai/helpers/zod'
import Docxtemplater from 'docxtemplater'
import notifier from 'node-notifier'
import { v4 as uuidv4 } from 'uuid'
// import dotenv from 'dotenv'
// dotenv.config()

// import iconImage from '../../resources/icon.png?asset'
import image from '../../resources/images.png?asset'
import axios from 'axios'

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))

const globalKeyboardListener = new GlobalKeyboardListener()

interface ApplicationDataType {
  id?: string;
  jobDescription: string;
  resume: any;
}

let applications: ApplicationDataType[] = []

let mainWindow: BrowserWindow;

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 200,
    height: 300,
    minHeight: 300,
    maxHeight: 300,
    // resizable: false,
    show: false,
    transparent: true,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    frame: false,
    ...(process.platform === 'linux' ? { image } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    x: 0,
    y: 200,
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

let tray: Tray
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  // electronApp.setAppUserModelId('com.electron')

  const gotTheLock = app.requestSingleInstanceLock()
  tray = new Tray(image)

  if (!gotTheLock) {
    tray.displayBalloon({
      title: 'Resume Generator',
      content: 'Another instance is already running.'
    })
    app.quit()
  }

  // notifier.notify({
  //   icon: LightCaution,
  //   title: 'Resume Generator',
  //   message: 'Ready to generate resumes.'
  // })

  // createWindow()
  setupGlobalKeyboardListener()

  const contextMenu = Menu.buildFromTemplate([{ label: 'Quit', click: () => app.quit() }])
  tray.setToolTip('Resume Generator')
  tray.setContextMenu(contextMenu)
  createWindow()
  // showNotification('Ready to generate resumes.')
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const generateResume = async (application, response?) => {
  applications.push(application)
  mainWindow.webContents.send('message', {
    id: application.id + '-selected',
    text: 'Selected : ' + application.jobDescription,
    type: 'selected-text'
  })
  const startTime = new Date().getTime()
  axios({
    method: 'post',
    url: config.hostUrl + '/generate',
    data: application,
    responseType: 'stream'
  }).then(response => {

    const contentDisposition = response.headers['content-disposition'];
    let fileName = 'downloaded_file';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        fileName = match[1];
      }
    }

    const saveFileName = response.headers['save-filename'] || 'Resume' + new Date().getTime() + '.docx';
    const finalSavePath = `${config.outputDir}/${saveFileName}`;
    const writer = fs.createWriteStream(finalSavePath);
    response.data.pipe(writer);
    const endTime = new Date().getTime()
    const companyName = saveFileName.split('-').pop().replace(/\.docx/g, '')
    writer.on('finish', () => {
      writer.close();
      mainWindow.webContents.send('message', {
        id: application.id,
        text: `Generated : ${(endTime - startTime).toLocaleString()}ms : ${companyName}`,
        type: 'success'
      })
      openFile(finalSavePath)
    });
  }).catch(err => {
    if (err.response.status === 409) {
      mainWindow.webContents.send('message', {
        id: application.id,
        text: 'Conflict : ' + err.response.headers['company-name'],
        type: 'same-company'
      })
    } else {
      mainWindow.webContents.send('message', {
        id: application.id,
        text: err instanceof Error ? err.message : 'Unknown error',
        type: 'error'
      })
    }
  });
}

ipcMain.on('proceed', (event, id, proceed) => {
  id = id.replace(/-same-company/g, '')
  const application = applications.find((app) => app.id === id)
  if (application && proceed) {
    const startTime = new Date().getTime()
    axios({
      method: 'get',
      url: config.hostUrl + '/proceed',
      params: { id: application.id },
      responseType: 'stream'
    }).then(response => {
      const contentDisposition = response.headers['content-disposition'];
      let fileName = 'downloaded_file';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          fileName = match[1];
        }
      }

      const saveFileName = response.headers['save-filename'] || 'Resume' + new Date().getTime() + '.docx';
      const finalSavePath = `${config.outputDir}/${saveFileName}`;
      const writer = fs.createWriteStream(finalSavePath);
      response.data.pipe(writer);
      const endTime = new Date().getTime()
      const companyName = saveFileName.split('-').pop().replace(/\.docx/g, '')
      writer.on('finish', () => {
        writer.close();
        mainWindow.webContents.send('message', {
          id: application.id,
          text: `Generated : ${(endTime - startTime).toLocaleString()}ms : ${companyName}`,
          type: 'success'
        })
        openFile(finalSavePath)
      });
    }).catch(err => {
      mainWindow.webContents.send('message', {
        id: application.id,
        text: err instanceof Error ? err.message : 'Unknown error',
        type: 'error'
      })
    });
  }
});

const setupGlobalKeyboardListener = () => {
  globalKeyboardListener.addListener(function (e, down) {
    if (e.state == 'DOWN' && e.name == 'SECTION' && down['LEFT CTRL']) {
      getText()
        .then((jobDescription) => {
          if (!jobDescription) {
            throw new Error('No text selected')
          }
          // notifier.notify({
          //   title: 'Generating resume...',
          //   message: jobDescription
          // })
          const application: ApplicationDataType = {
            id: uuidv4(),
            jobDescription,
            resume: null
          }
          generateResume(application)
        })
        .catch((err) => {
          // notifier.notify({
          //   icon: LightError,
          //   title: 'Resume Generator',
          //   message: err.message
          // })
          mainWindow.webContents.send('message', {
            id: uuidv4(),
            text: err.message,
            type: 'selected-text-error'
          })
        })
    }
  })
}

const openFile = (filePath) => {
  switch (process.platform) {
    case 'darwin':
      exec(`open "${filePath}"`)
      break
    case 'win32':
      exec(`start "" "${filePath}"`, { windowsHide: false })
      break
    default:
      exec(`xdg-open "${filePath}"`)
  }
}
