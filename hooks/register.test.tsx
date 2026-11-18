import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-monitor',
  component: 'Pane',
  requestId: 'session-monitor',
  props: {
    title: '세션 모니터',
    isFocused: false,
    bodyColumns: 26,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('패널이 목표·고친 파일·도구 호출을 그린다', async ($, on) => {
  on('command.register', () => ({ value: { command: 'session-monitor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/Users/x/a/foo.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /foo\.ts/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Bash/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Claude/ })).toBeTruthy()
  // 호버 카드: 전체 파일명과 위치가 트리에 있다.
  expect(await ui.find({ type: 'Text', text: /\/Users\/x\/a\// })).toBeTruthy()
  await ui.unmount()
})
