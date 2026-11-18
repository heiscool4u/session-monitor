export type ToolEntry = {
  id: string
  tool: string
  detail: string
  at: string
  status: 'running' | 'done' | 'error'
}

export type FileEntry = {
  path: string
  count: number
  tool: string
  at: string
}

declare module 'claude-code' {
  interface PluginState {
    'session-monitor': {
      goal: Shaped<string>
      tools: Shaped<ToolEntry[]>
      files: Shaped<FileEntry[]>
    }
  }
}
