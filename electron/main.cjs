const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { screen } = require('electron');
const { NsisUpdater } = require('electron-updater');

const defaultConfig = {
  graphics: {
    rendererPreference: 'webgl',
    experimentalWebGpu: false,
    graphicsPreset: 'high',
    dlssMode: 'off',
    displayMode: 'windowed',
    showFpsCounter: false,
    vSync: true,
    fpsCap: '60',
    resolutionScale: '1',
    shadowQuality: 'high',
    fogEnabled: true,
    fakeRtxMode: false,
    dayNightCycle: false,
    sfxVolume: 0.7,
    sfxMuted: false
  },
  messages: {
    introChallenge: 'Try and beat 850 Amanda.... lots of love, Reece',
    ready: 'Press <strong>Space</strong> to launch the run.',
    running: 'Use the full arena. Chase the <strong>bubblegum pink super food</strong> for bigger growth.',
    edgeWarning: 'Border ahead. Turn now to stay inside the <strong>highlighted arena</strong>.',
    gameOver: 'Run over. Press <strong>Space</strong> to restart.'
  },
  prizes: [
    {
      threshold: 300,
      message: 'Amanda, collect your <strong>300 points prize</strong> from Reece.',
      durationMs: 10000
    },
    {
      threshold: 800,
      message: 'Amanda, collect your <strong>800 points prize</strong> from Reece.',
      durationMs: 10000
    }
  ]
};

function findFirstExistingPath(...paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || paths[0];
}

function getBundledDir() {
  return app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
}

function getExternalInstallDir() {
  return app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'snake3d.config.json');
}

function getIconPath() {
  return findFirstExistingPath(
    path.join(getExternalInstallDir(), 'assets', 'snake.ico'),
    path.join(process.resourcesPath, 'assets', 'snake.ico'),
    path.join(getBundledDir(), 'assets', 'snake.ico')
  );
}

function getLegacyConfigPath() {
  return path.join(getExternalInstallDir(), 'snake3d.config.json');
}

function getGitHubConfigPath() {
  return findFirstExistingPath(
    path.join(getExternalInstallDir(), 'snake3d.github.json'),
    path.join(process.resourcesPath, 'snake3d.github.json'),
    path.join(getBundledDir(), 'snake3d.github.json')
  );
}

function getReleasePageUrl() {
  const githubConfig = readGitHubConfig();
  if (!githubConfig.owner || !githubConfig.releaseRepo) {
    return 'https://github.com';
  }

  return `https://github.com/${githubConfig.owner}/${githubConfig.releaseRepo}/releases`;
}

function readGitHubConfig() {
  const fallback = {
    owner: 'REPLACE_WITH_GITHUB_USERNAME',
    repo: 'snake-together',
    releaseRepo: 'snake-together-releases',
    channel: 'latest',
    enabled: false
  };

  if (!fs.existsSync(getGitHubConfigPath())) {
    return fallback;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(getGitHubConfigPath(), 'utf8'));
    return {
      ...fallback,
      ...raw
    };
  } catch {
    return fallback;
  }
}

function mergeConfig(rawConfig = {}) {
  return {
    graphics: {
      ...defaultConfig.graphics,
      ...(rawConfig.graphics || {})
    },
    messages: {
      ...defaultConfig.messages,
      ...(rawConfig.messages || {})
    },
    prizes: Array.isArray(rawConfig.prizes) && rawConfig.prizes.length > 0
      ? rawConfig.prizes.map((prize) => ({
          threshold: Number(prize.threshold) || 0,
          message: typeof prize.message === 'string' ? prize.message : '',
          durationMs: Number(prize.durationMs) || 10000
        }))
      : defaultConfig.prizes
  };
}

function readConfig() {
  const configPath = getConfigPath();
  const legacyConfigPath = getLegacyConfigPath();

  if (!fs.existsSync(configPath) && fs.existsSync(legacyConfigPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.copyFileSync(legacyConfigPath, configPath);
  }

  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
    return defaultConfig;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return mergeConfig(raw);
  } catch {
    fs.writeFileSync(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
    return defaultConfig;
  }
}

function writeConfig(nextConfig) {
  const merged = mergeConfig(nextConfig);
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return merged;
}

const bootConfig = readConfig();

if (bootConfig.graphics.experimentalWebGpu) {
  app.commandLine.appendSwitch('enable-unsafe-webgpu');
}

if (!bootConfig.graphics.vSync) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}

let mainWindow = null;
let lastWindowedBounds = null;
let updater = null;
const launchMode = process.argv.includes('--updater-mode') ? 'updater' : 'game';
let updateState = {
  configured: false,
  status: 'idle',
  message: 'Updater not configured yet.',
  version: app.getVersion(),
  progress: 0,
  updateAvailable: false,
  downloaded: false
};

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch
  };

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('snake3d:update-state', updateState);
    }
  });
}

function initUpdater() {
  if (!app.isPackaged) {
    setUpdateState({
      configured: false,
      status: 'disabled',
      message: 'Updater works in installed builds only.',
      progress: 0,
      updateAvailable: false,
      downloaded: false
    });
    return;
  }

  const githubConfig = readGitHubConfig();
  const ownerReady = githubConfig.owner && githubConfig.owner !== 'REPLACE_WITH_GITHUB_USERNAME';
  const repoReady = githubConfig.releaseRepo && githubConfig.releaseRepo !== 'REPLACE_WITH_RELEASE_REPO';

  if (!githubConfig.enabled || !ownerReady || !repoReady) {
    setUpdateState({
      configured: false,
      status: 'disabled',
      message: 'Updater is waiting for a real GitHub owner/release repo in snake3d.github.json.',
      progress: 0,
      updateAvailable: false,
      downloaded: false
    });
    return;
  }

  updater = new NsisUpdater({
    provider: 'github',
    owner: githubConfig.owner,
    repo: githubConfig.releaseRepo,
    private: false
  });

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  setUpdateState({
    configured: true,
    status: 'ready',
    message: 'Updater ready. Check for updates whenever you want.',
    progress: 0,
    updateAvailable: false,
    downloaded: false
  });

  updater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: 'Checking GitHub for a new version...',
      progress: 0,
      updateAvailable: false,
      downloaded: false
    });
  });

  updater.on('update-available', (info) => {
    setUpdateState({
      status: 'downloading',
      message: `Update ${info.version} found. Downloading now...`,
      progress: 0,
      updateAvailable: true,
      downloaded: false
    });
  });

  updater.on('update-not-available', () => {
    setUpdateState({
      status: 'up-to-date',
      message: `You're already on the latest version (${app.getVersion()}).`,
      progress: 100,
      updateAvailable: false,
      downloaded: false
    });
  });

  updater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      message: `Downloading update... ${Math.round(progress.percent || 0)}%`,
      progress: progress.percent || 0,
      updateAvailable: true,
      downloaded: false
    });
  });

  updater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      message: `Update ${info.version} is ready to install.`,
      progress: 100,
      updateAvailable: true,
      downloaded: true
    });
  });

  updater.on('error', (error) => {
    setUpdateState({
      status: 'error',
      message: `Updater error: ${error.message}`,
      progress: 0,
      updateAvailable: false,
      downloaded: false
    });
  });
}

function buildWindowOptions(config) {
  if (launchMode === 'updater') {
    return {
      width: 560,
      height: 420,
      minWidth: 520,
      minHeight: 380,
      autoHideMenuBar: true,
      backgroundColor: '#11091d',
      title: 'Snake Together Updater',
      icon: fs.existsSync(getIconPath()) ? getIconPath() : undefined,
      maximizable: false,
      fullscreenable: false,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    };
  }

  const displayMode = config.graphics.displayMode || 'windowed';
  const isBorderless = displayMode === 'borderless';
  const isFullscreen = displayMode === 'fullscreen';
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workAreaSize;

  return {
    width: isBorderless ? workArea.width : 1440,
    height: isBorderless ? workArea.height : 960,
    minWidth: isBorderless ? undefined : 980,
    minHeight: isBorderless ? undefined : 720,
    autoHideMenuBar: true,
    backgroundColor: '#07101d',
    title: 'Snake: Together',
    icon: fs.existsSync(getIconPath()) ? getIconPath() : undefined,
    frame: !isBorderless,
    fullscreen: isFullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
}

function applyDisplayMode(win, config) {
  const displayMode = config.graphics.displayMode || 'windowed';
  const workArea = screen.getPrimaryDisplay().workArea;

  if (displayMode === 'fullscreen') {
    if (!win.isMaximized() && !win.isFullScreen()) {
      lastWindowedBounds = win.getBounds();
    }
    win.setFullScreen(false);
    win.setFullScreen(true);
    return;
  }

  win.setFullScreen(false);

  if (displayMode === 'windowed') {
    win.setResizable(true);
    if (lastWindowedBounds) {
      win.setBounds(lastWindowedBounds);
    } else {
      win.setSize(1440, 960);
      win.center();
    }
    return;
  }

  if (displayMode === 'borderless') {
    if (!win.isMaximized()) {
      lastWindowedBounds = win.getBounds();
    }
    win.setBounds(workArea);
  }
}

function createWindow(config = bootConfig) {
  const win = new BrowserWindow(buildWindowOptions(config));
  mainWindow = win;

  if (launchMode === 'updater') {
    win.loadFile(path.join(__dirname, 'updater.html'));
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.once('ready-to-show', () => {
    if (launchMode === 'updater') {
      win.center();
    } else {
      applyDisplayMode(win, config);
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
}

ipcMain.handle('snake3d:get-config', () => readConfig());
ipcMain.handle('snake3d:save-config', (_event, nextConfig) => writeConfig(nextConfig));
ipcMain.handle('snake3d:get-update-state', () => updateState);
ipcMain.handle('snake3d:get-launch-mode', () => launchMode);
ipcMain.handle('snake3d:get-release-page-url', () => getReleasePageUrl());
ipcMain.handle('snake3d:check-for-updates', async () => {
  if (!updater) {
    return updateState;
  }

  await updater.checkForUpdates();
  return updateState;
});
ipcMain.handle('snake3d:open-release-page', async () => {
  await shell.openExternal(getReleasePageUrl());
  return { ok: true };
});
ipcMain.handle('snake3d:install-update', async () => {
  if (!updater || !updateState.downloaded) {
    return updateState;
  }

  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Install now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Install update',
    message: 'The latest Snake: Together update is ready. Install it now?'
  });

  if (result.response === 0) {
    updater.quitAndInstall(false, true);
  }

  return updateState;
});
ipcMain.handle('snake3d:launch-main-app', async () => {
  if (!app.isPackaged) {
    return { ok: false, message: 'Launch shortcut works in packaged builds only.' };
  }

  spawn(process.execPath, [], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  setTimeout(() => {
    app.quit();
  }, 150);

  return { ok: true };
});
ipcMain.handle('snake3d:apply-graphics-settings', (_event, graphicsPatch) => {
  const currentConfig = readConfig();
  const nextConfig = writeConfig({
    ...currentConfig,
    graphics: {
      ...currentConfig.graphics,
      ...graphicsPatch
    }
  });

  const nextDisplayMode = nextConfig.graphics.displayMode || 'windowed';
  const currentDisplayMode = currentConfig.graphics.displayMode || 'windowed';

  if (mainWindow && nextDisplayMode === currentDisplayMode && nextDisplayMode !== 'borderless') {
    if (nextDisplayMode === 'windowed' && mainWindow && !mainWindow.isFullScreen()) {
      lastWindowedBounds = mainWindow.getBounds();
    }
    applyDisplayMode(mainWindow, nextConfig);
  } else if (mainWindow) {
    const bounds = mainWindow.getBounds();
    if (currentDisplayMode === 'windowed') {
      lastWindowedBounds = bounds;
    }
    mainWindow.destroy();
    createWindow(nextConfig);
  }

  return {
    config: nextConfig,
    restartRequired:
      currentConfig.graphics.vSync !== nextConfig.graphics.vSync ||
      currentConfig.graphics.experimentalWebGpu !== nextConfig.graphics.experimentalWebGpu
  };
});

app.whenReady().then(() => {
  createWindow(bootConfig);
  initUpdater();

  if (launchMode === 'updater') {
    setTimeout(() => {
      if (updater) {
        updater.checkForUpdates().catch((error) => {
          setUpdateState({
            status: 'error',
            message: `Updater error: ${error.message}`,
            progress: 0,
            updateAvailable: false,
            downloaded: false
          });
        });
      }
    }, 900);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
