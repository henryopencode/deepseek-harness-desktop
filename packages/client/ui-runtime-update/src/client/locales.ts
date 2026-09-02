/** `runtimeUpdate` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  title: '发现新版本',
  description: '当前版本 {current}，最新版本 {latest}。',
  later: '稍后',
  install: '立即更新',
  installing: '正在更新…',
  waiting: '正在下载并安装更新；首次更新可能需要数分钟，完成后服务会自动重启。',
  progressLabel: '更新进度',
  phaseIdle: '等待更新',
  phaseChecking: '检查更新',
  phaseDownloading: '下载更新',
  phaseVerifying: '校验更新',
  phaseExtracting: '解压更新',
  phaseInstalling: '安装依赖',
  phaseSwitching: '切换版本',
  phaseRestarting: '重启服务',
  phaseCompleted: '更新完成',
  phaseFailed: '更新失败',
  remote: '远程部署请通过 SSH 更新服务器。',
  error: '更新失败：{message}',
  timeout: '更新仍可能在后台进行；请稍后刷新页面检查版本。',
  close: '关闭更新提示',
} satisfies Record<string, string>

/** Runtime-update dictionary key union. */
export type RuntimeUpdateKey = keyof typeof zh

/** English dictionary, checked complete against the Chinese key set. */
export const en = {
  title: 'New version available',
  description: 'Current version {current}, latest version {latest}.',
  later: 'Later',
  install: 'Update now',
  installing: 'Updating…',
  waiting: 'Downloading and installing the update. A first update may take several minutes; the service restarts automatically when it finishes.',
  progressLabel: 'Update progress',
  phaseIdle: 'Waiting for update',
  phaseChecking: 'Checking for updates',
  phaseDownloading: 'Downloading update',
  phaseVerifying: 'Verifying update',
  phaseExtracting: 'Extracting update',
  phaseInstalling: 'Installing dependencies',
  phaseSwitching: 'Switching version',
  phaseRestarting: 'Restarting service',
  phaseCompleted: 'Update complete',
  phaseFailed: 'Update failed',
  remote: 'Use SSH to update the remote deployment.',
  error: 'Update failed: {message}',
  timeout: 'The update may still be running in the background. Refresh the page later to check the version.',
  close: 'Close update notice',
} satisfies Record<RuntimeUpdateKey, string>
