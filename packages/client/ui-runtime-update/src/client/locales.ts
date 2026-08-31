/** `runtimeUpdate` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  title: '发现新版本',
  description: '当前版本 {current}，最新版本 {latest}。',
  later: '稍后',
  install: '立即更新',
  installing: '正在更新…',
  waiting: '更新已启动，正在等待服务重启…',
  remote: '远程部署请通过 SSH 更新服务器。',
  error: '更新失败：{message}',
  timeout: '服务重启超时，请稍后刷新页面。',
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
  waiting: 'Update started. Waiting for the service to restart…',
  remote: 'Use SSH to update the remote deployment.',
  error: 'Update failed: {message}',
  timeout: 'The service did not restart in time. Refresh the page later.',
  close: 'Close update notice',
} satisfies Record<RuntimeUpdateKey, string>
