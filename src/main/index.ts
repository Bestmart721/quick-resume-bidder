/* eslint-disable @typescript-eslint/explicit-function-return-type */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { app, shell, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } from 'electron'
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

// import iconImage from '../../resources/icon.png?asset'
import image from '../../resources/images.png?asset'
import LightCaution from '../../resources/LightCaution.png?asset'
import LightError from '../../resources/LightError.png?asset'
import LightSuccess from '../../resources/LightSuccess.png?asset'
import config from '../../config.json'

const instructions = fs.readFileSync(path.resolve('instructions.txt'), 'utf8')

const globalKeyboardListener = new GlobalKeyboardListener()

const generatedResumeExtracted = zod.object({
  companyName: zod.string(),
  roleTitle: zod.string(),
  developerTitle: zod.string(),
  summary: zod.string(),
  skills: zod.array(
    zod.object({
      group: zod.string(),
      keywords: zod.array(zod.string())
    })
  ),
  experience_first: zod.array(zod.string()),
  experience_second: zod.array(zod.string()),
  experience_third: zod.array(zod.string())
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  // electronApp.setAppUserModelId('com.electron')

  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    notifier.notify({
      title: 'Resume Generator',
      message: 'Another instance of the app is already running.',
      icon: LightCaution
    })
    app.quit()
  }

  notifier.notify({
    icon: LightSuccess,
    title: 'Resume Generator',
    message: 'Ready to generate resumes.'
  })

  logMessage('++++++ Resume writer is ready. ++++++')
  const tray = new Tray(image)
  const contextMenu = Menu.buildFromTemplate([{ label: 'Quit', click: () => app.quit() }])
  tray.setToolTip('Resume Generator')
  tray.setContextMenu(contextMenu)
  setupGlobalKeyboardListener()
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
  apiKey: config.openApiKey
})

const generateResume = async (jobDescription) => {
  const completion = await openai.beta.chat.completions.parse({
    //model: "gpt-4o-2024-08-06",
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: jobDescription }
    ],
    response_format: zodResponseFormat(generatedResumeExtracted, 'research_paper_extraction')
  })

  const outputDir = config.outputDir
  if (!outputDir) {
    notifier.notify({
      title: 'Resume Generator',
      message: 'Output directory is not defined.',
      icon: LightError
    })
    throw new Error('OUTPUT_DIR environment variable is not defined')
  }

  const resumeData = JSON.parse(completion.choices[0].message.content || '{}')
  const expectedFileName = formatString(
    config.outputFilename,
    resumeData.roleTitle,
    resumeData.companyName
  )
  const filenames = fs.readdirSync(outputDir)
  let sameExists = false
  filenames.forEach((str) => {
    str = str.replace('.txt', '')
    str = str.split('-').pop() || str
    if (str === resumeData.companyName) {
      sameExists = true
    }
  })

  if (sameExists) {
    notifier.notify(
      {
        title: 'Resume Generator',
        message: `A resume with the same company already exists: ${resumeData.roleTitle} / ${resumeData.companyName}\nDo you want to proceed?`,
        icon: LightCaution,
        actions: ['Yes', 'No']
      },
      (err, response) => {
        if (response === 'yes') {
          const newFileName = expectedFileName + '(' + Math.floor(Math.random() * 1000) + ')'
          exportResume(resumeData, newFileName)
          exportJobDescription(jobDescription, newFileName)
        }
      }
    )
  } else {
    exportResume(resumeData, expectedFileName)
    exportJobDescription(jobDescription, expectedFileName)
  }
}

const exportJobDescription = async (jobDescription, fileName) => {
  const outputDir = config.outputDir
  if (!outputDir) {
    throw new Error('OUTPUT_DIR environment variable is not defined')
  }
  fs.writeFileSync(path.resolve(outputDir, fileName + '.txt'), jobDescription)
}

const exportResume = async (resume, fileName) => {
  const content = fs.readFileSync(path.resolve('template.docx'), 'binary')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  })

  const options = {
    title: resume.developerTitle,
    lastJob: resume.roleTitle,
    summary: resume.summary.replace(/\*/g, ''),
    skills: resume.skills.map((skill) => ({
      group: skill.group,
      keywords: skill.keywords.join(', ').replace(/\*\*/g, '')
    })),
    bullets1: formatBullets(resume.experience_first),
    bullets2: formatBullets(resume.experience_second),
    bullets3: formatBullets(resume.experience_third)
  }

  doc.render(options)
  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  })

  const outputDir = config.outputDir
  if (!outputDir) {
    throw new Error('OUTPUT_DIR environment variable is not defined')
  }
  const outputPath = path.resolve(outputDir, fileName + '.docx')

  try {
    fs.writeFileSync(outputPath, buf)
    openFile(outputPath)
    notifier.notify({
      title: 'Resume Generator',
      message: 'Resume generated successfully\n' + resume.roleTitle + ' / ' + resume.companyName,
      icon: LightSuccess
    })
  } catch (err) {
    logMessage(err)
    notifier.notify({
      title: 'Resume Generator',
      message: err instanceof Error ? err.message : 'Unknown error'
    })
  }
}

function formatString(template, ...args) {
  args = args.map((arg) => {
    arg = arg.replace(/\/|\\|:|\*|\?|"|<|>|\||-/g, '_')
    return arg
  })
  return template.replace(/{(\d+)}/g, (match, index) => args[index] || '')
}

const formatBullets = (bulletsArray) => {
  return bulletsArray.map((bullet) => {
    const words = bullet.split('**')
    const segments = words.map((word, index) => ({
      bold: index % 2 == 1 ? word : '',
      plain: index % 2 == 0 ? word : ''
    }))
    return { bullet: segments }
  })
}

const setupGlobalKeyboardListener = () => {
  globalKeyboardListener.addListener(function (e, down) {
    if (e.state == 'DOWN' && e.name == 'SPACE' && down['LEFT CTRL']) {
      getText()
        .then((jobDescription) => {
          if (!jobDescription) {
            throw new Error('No text selected')
          }
          notifier.notify({
            title: 'Generating resume...',
            message: jobDescription
          })
          generateResume(jobDescription)
        })
        .catch((err) => {
          notifier.notify({
            icon: LightError,
            title: 'Resume Generator',
            message: err.message
          })
          logMessage(err)
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

const logMessage = (message) => {
  const logFilePath = path.join(__dirname, 'app.log')
  const logEntry = `${new Date().toISOString()} - ${message}\n`
  console.log(message)
  fs.appendFileSync(logFilePath, logEntry)
}

// require('electron-reload')(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`)
// });
