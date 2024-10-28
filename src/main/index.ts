import { app, shell, BrowserWindow, ipcMain, Notification, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
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

import image from '../../resources/images.png?asset'
import config from '../../config.json'

const globalKeyboardListener = new GlobalKeyboardListener();

// function createWindow(): void {
//   // Create the browser window.
//   const mainWindow = new BrowserWindow({
//     width: 900,
//     height: 670,
//     show: false,
//     autoHideMenuBar: true,
//     ...(process.platform === 'linux' ? { icon } : {}),
//     webPreferences: {
//       preload: join(__dirname, '../preload/index.js'),
//       sandbox: false
//     }
//   })

//   mainWindow.on('ready-to-show', () => {
//     mainWindow.show()
//   })

//   mainWindow.webContents.setWindowOpenHandler((details) => {
//     shell.openExternal(details.url)
//     return { action: 'deny' }
//   })

//   // HMR for renderer base on electron-vite cli.
//   // Load the remote URL for development or the local html file for production.
//   if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
//     mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
//   } else {
//     mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
//   }
// }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  
  logMessage('++++++ Resume writer is ready. ++++++');
  const tray = new Tray(image);
  const contextMenu = Menu.buildFromTemplate([
      { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('Resume Generator');
  tray.setContextMenu(contextMenu);
  setupGlobalKeyboardListener();

  // // Default open or close DevTools by F12 in development
  // // and ignore CommandOrControl + R in production.
  // // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  // app.on('browser-window-created', (_, window) => {
  //   optimizer.watchWindowShortcuts(window)
  // })

  // // IPC test
  // ipcMain.on('ping', () => console.log('pong'))

  // createWindow()

  // app.on('activate', function () {
  //   // On macOS it's common to re-create a window in the app when the
  //   // dock icon is clicked and there are no other windows open.
  //   if (BrowserWindow.getAllWindows().length === 0) createWindow()
  // })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const openai = new OpenAI({
  dangerouslyAllowBrowser: true,
  apiKey: config.openApiKey,
})

const generateResume = async (jobDescription) => {
  const generatedResumeExtracted = zod.object({
    companyName: zod.string(),
    roleTitle: zod.string(),
    summary: zod.string(),
    skills: zod.array(zod.object({
      group: zod.string(),
      keywords: zod.array(zod.string()),
    })),
    experience_first: zod.array(zod.string()),
    experience_second: zod.array(zod.string()),
    experience_third: zod.array(zod.string()),
  });

  const completion = await openai.beta.chat.completions.parse({
    //model: "gpt-4o-2024-08-06",
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: resources.instructionResume },
      { role: "user", content: jobDescription },
    ],
    response_format: zodResponseFormat(generatedResumeExtracted, "research_paper_extraction"),
  });

  exportResume(JSON.parse(completion.choices[0].message.content || '{}'));
  exportJobDescription(jobDescription, JSON.parse(completion.choices[0].message.content || '{}'));
}

const exportJobDescription = async (jobDescription, resume) => {
  const outputDir = config.outputDir;
  if (!outputDir) {
    throw new Error('OUTPUT_DIR environment variable is not defined');
  }
  fs.writeFileSync(
    path.resolve(outputDir, `MatthewSliger-${resume.roleTitle.replace(/\//g, '-')}-${resume.companyName}.txt`),
    jobDescription
  )
}

const exportResume = async (resume) => {
  const content = fs.readFileSync(path.resolve('template.docx'), 'binary')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  })

  const options = {
    title: resume.roleTitle,
    lastJob: resume.roleTitle,
    summary: resume.summary.replace(/\*/g, ''),
    skills: resume.skills.map((skill) => ({
      group: skill.group,
      keywords: skill.keywords.join(', ')
    })),
    bullets1: formatBullets(resume.experience_first),
    bullets2: formatBullets(resume.experience_second),
    bullets3: formatBullets(resume.experience_third),
  }

  doc.render(options)
  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  })

  const revisedJobTitle = resume.roleTitle.replace(/\//g, '-');
  const outputDir = config.outputDir;
  if (!outputDir) {
    throw new Error('OUTPUT_DIR environment variable is not defined');
  }
  const outputPath = path.resolve(
    outputDir,
    `MatthewSliger-${revisedJobTitle}-${resume.companyName}.docx`
  )

  try {
    fs.writeFileSync(outputPath, buf)
    openFile(outputPath)
  } catch (err) {
    logMessage(err);
    new Notification({
      title: 'Resume Generator',
      body: (err instanceof Error ? err.message : 'Unknown error')
    }).show();
  }
}

const formatBullets = (bulletsArray) => {
  return bulletsArray.map((bullet) => {
    let words = bullet.split('**')
    const segments = words.map((word, index) => ({
      bold: index % 2 == 1 ? word : '',
      plain: index % 2 == 0 ? word : ''
    }))
    return { bullet: segments }
  })
}

const setupGlobalKeyboardListener = () => {
  globalKeyboardListener.addListener(function (e, down) {
    if (e.state == "DOWN" && e.name == "SPACE" && down["LEFT CTRL"]) {
      getText().then((jobDescription) => {
        if (!jobDescription) {
          throw new Error('No text selected');
        }
        new Notification({
          title: 'Generating resume...',
          body: jobDescription
        }).show();
        generateResume(jobDescription);
      }).catch((err) => {
        new Notification({
          title: 'Resume Generator',
          body: err.message
        }).show();
        logMessage(err);
      });
    }
  });
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

const logMessage = (message) => {
  const logFilePath = path.join(__dirname, 'app.log');
  const logEntry = `${new Date().toISOString()} - ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFilePath, logEntry);
}

// require('electron-reload')(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`)
// });