import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { FileEntry, ToolEntry } from '../types'

const PANE = 'session-monitor'
const TITLE = '세션 모니터'
// 터미널 폭의 약 20%: 도크는 최소 24칸이라 그 위에서 가장 좁게 요청한다.
const WIDTH = 26
const TICK_MS = 600
const SPINNER = ['·', '✢', '✳', '✶', '✻', '✽']
const ORANGE = '#D97757'
const RAINBOW = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#B197FC']
// 도구 종류별 색: 하단 상태줄처럼 한눈에 갈린다.
const TOOL_COLOR: Record<string, string> = {
  Bash: '#FFD43B',
  Read: '#4DD0E1',
  Grep: '#4DABF7',
  Glob: '#4DABF7',
  Edit: '#69DB7C',
  Write: '#69DB7C',
  MultiEdit: '#69DB7C',
  NotebookEdit: '#69DB7C',
  Agent: '#E599F7',
  WebFetch: '#FFA94D',
  WebSearch: '#FFA94D',
}
const baseOf = (p: string) => p.split('/').pop() ?? p
// 첫 파일 행의 y: 로고 3 + 띠 1 + 목표 칩 1 + 목표 3 + 빈 줄 1 + 파일 칩 1.
const FILE_ROW_TOP = 10
const colorOf = (tool: string) => TOOL_COLOR[tool] ?? '#ADB5BD'
let ticker: { cancel: () => void } | undefined
const MAX_TOOLS = 100
const MAX_FILES = 50
// 파일을 고치는 도구와 그 경로 인자 이름.
const EDIT_TOOLS: Record<string, string> = {
  Edit: 'file_path',
  Write: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
}

// 필드 모양이 바뀌면 태그를 올린다: 이전 버전이 저장한 값은 버려진다.
const goal = atom({ plugin: 'session-monitor', key: 'goal' } as const, '', {
  shape: 'goal-1',
})
const tools = atom({ plugin: 'session-monitor', key: 'tools' } as const, [], {
  shape: 'tools-1',
})
const files = atom({ plugin: 'session-monitor', key: 'files' } as const, [], {
  shape: 'files-2',
})

const clock = () => new Date().toTimeString().slice(0, 8)
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const short = (p: string) => p.replace(/^\/Users\/[^/]+/, '~')

// 도구마다 눈에 띄는 인자 하나를 뽑는다.
function detailOf(e: Record<string, unknown>): string {
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const raw =
    pick('command') ||
    pick('file_path') ||
    pick('notebook_path') ||
    pick('pattern') ||
    pick('url') ||
    pick('query') ||
    pick('description') ||
    pick('prompt')
  return short(oneLine(raw))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 이어하기·포크 때 엔진이 제목을 주면 그걸 목표로 쓴다.
    const title = (e as { session_title?: string }).session_title
    if (title) await update($, goal, () => oneLine(title))
    await $.command.register({
      name: 'session-monitor',
      description: '세션 모니터 패널을 연다',
    })
    void $.ui.open({ id: PANE, title: TITLE, columns: WIDTH, rows: 14 })
    ticker?.cancel()
    ticker = $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('command.run', { command: 'session-monitor' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, columns: WIDTH, rows: 14 })

    return { text: '세션 모니터를 열었습니다.' }
  })

  // 목표: 슬래시 명령이 아닌 첫 프롬프트.
  on('prompt.submit', async ($, e, next) => {
    if (!e.command && !e.isMeta) {
      const text = oneLine(e.text)
      if (text && (await read($, goal)) === '') {
        await update($, goal, () => text.slice(0, 200))
      }
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const entry: ToolEntry = {
      id: e.tool_use_id,
      tool: e.tool,
      detail: detailOf(args),
      at: clock(),
      status: 'running',
    }
    await update($, tools, list => [...list, entry].slice(-MAX_TOOLS))

    const ran = await next(e)
    const isFailed = ran.deny !== undefined || ran.isError === true
    await update($, tools, list =>
      list.map(one =>
        one.id === entry.id
          ? { ...one, status: isFailed ? 'error' : 'done' }
          : one,
      ),
    )

    const pathKey = EDIT_TOOLS[e.tool]
    const path = pathKey ? args[pathKey] : undefined
    if (!isFailed && typeof path === 'string') {
      await update($, files, list => {
        const key = path
        const rest = list.filter(f => f.path !== key)
        const prev = list.find(f => f.path === key)
        const next_: FileEntry = {
          path: key,
          count: (prev?.count ?? 0) + 1,
          tool: e.tool,
          at: clock(),
        }
        return [...rest, next_].slice(-MAX_FILES)
      })
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [goalText, toolList, fileList] = await Promise.all([
      read($, goal),
      read($, tools),
      read($, files),
    ])
    const frame = Math.floor(Date.now() / TICK_MS)
    const isBusy = toolList.some(t => t.status === 'running')
    const cols = Math.max(20, e.props.bodyColumns ?? WIDTH)
    const rows = Math.max(12, e.viewport?.rows ?? 24)
    // 로고(3)·구분띠(1)·머리표 3개(3)·목표(3)·빈 줄(2)을 빼고 둘로 나눈다.
    const room = Math.max(4, rows - 12)
    const fileRoom = Math.max(2, Math.floor(room / 3))
    const toolRoom = Math.max(2, room - fileRoom)
    const shownFiles = fileList.slice(-fileRoom).reverse()
    const mark = { running: '●', done: '✓', error: '✗' } as const
    const feet = frame % 2 === 0 ? '  ▘▘ ▝▝' : '  ▝▝ ▘▘'
    const goalShown =
      goalText.length > 36 ? goalText.slice(0, 36) + '…' : goalText
    const chip = (text: string, bg: string) => (
      <Text bold color="#111111" backgroundColor={bg}>
        {` ${text} `}
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexDirection="column">
            <Text color={ORANGE}>{' ▐▛███▜▌'}</Text>
            <Text color={ORANGE}>{'▝▜█████▛▘'}</Text>
            <Text color={ORANGE}>{feet}</Text>
          </Box>
          <Box flexDirection="column" marginLeft={1}>
            <Text bold color={ORANGE}>
              {SPINNER[frame % SPINNER.length]} Claude
            </Text>
            <Text color={isBusy ? '#69DB7C' : '#868E96'}>
              {isBusy ? '● 작업 중' : '○ 대기'}
            </Text>
            <Text dimColor>
              {toolList.length}회 · {fileList.length}파일
            </Text>
          </Box>
        </Box>
        <Text>
          {Array.from({ length: Math.floor(cols / 2) }, (_, i) => (
            <Text color={RAINBOW[(i + frame) % RAINBOW.length]}>▬▬</Text>
          ))}
        </Text>

        {chip('세션 목표', '#4DABF7')}
        <Box height={3}>
          <Text wrap="wrap" color="#E7F5FF">
            {goalShown || '(첫 프롬프트 대기)'}
          </Text>
        </Box>

        <Text> </Text>
        {chip(`고친 파일 ${fileList.length}`, '#69DB7C')}
        {fileList.length === 0 && <Text dimColor>아직 없음</Text>}
        {shownFiles.map((f, i) => (
          <Text
            wrap="truncate-end"
            hover={{ scope: `file-${i}`, backgroundColor: '#2F4F3A', bold: true }}
          >
            <Text dimColor>{f.at.slice(0, 5)} </Text>
            <Text color="#B2F2BB">{baseOf(f.path)}</Text>
            {f.count > 1 && <Text color="#FFD43B">{` ×${f.count}`}</Text>}
          </Text>
        ))}

        <Text> </Text>
        {chip(`도구 호출 ${toolList.length}`, '#E599F7')}
        {toolList.length === 0 && <Text dimColor>아직 없음</Text>}
        {toolList.slice(-toolRoom).reverse().map(t => (
          <Text wrap="truncate-end">
            <Text
              bold
              color={t.status === 'error' ? '#FF6B6B' : colorOf(t.tool)}
            >
              {mark[t.status]} {t.tool}
            </Text>
            <Text dimColor> {t.detail}</Text>
          </Text>
        ))}

        {shownFiles.map((f, i) => (
          <Box
            position="absolute"
            top={FILE_ROW_TOP + i + 1}
            left={0}
            width={cols}
            display="none"
            hover={{ scope: `file-${i}`, display: 'flex' }}
            flexDirection="column"
            borderStyle="round"
            borderColor="#69DB7C"
            backgroundColor="#1B2B21"
            paddingX={1}
          >
            <Text bold wrap="wrap" color="#B2F2BB">
              {baseOf(f.path)}
            </Text>
            <Text wrap="wrap" color="#E7F5FF">
              {f.path.slice(0, f.path.length - baseOf(f.path).length)}
            </Text>
            <Text dimColor>
              {f.tool} · {f.at} · {f.count}회
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
