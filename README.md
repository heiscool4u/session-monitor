# session-monitor

Claude Code 터미널 옆에 붙는 우측 패널 mod입니다. 지금 세션에서 Claude가 무엇을 하는지 실시간으로 보여줍니다.

- **세션 목표** — 첫 프롬프트(이어하기·포크면 세션 제목)를 상단에 표시
- **고친 파일** — Edit·Write·MultiEdit·NotebookEdit가 성공한 파일. 마우스를 올리면 전체 파일명과 위치(절대경로)가 카드로 뜹니다
- **도구 호출** — 실행 중 `●`, 완료 `✓`, 실패 `✗`. 도구 종류별로 색이 다릅니다
- 움직이는 Claude 로고와 흐르는 색 띠, 폭 26칸의 좁은 패널

## 설치

터미널 세션의 프롬프트에서:

```
/plugin install session-monitor --marketplace heiscool4u/session-monitor
```

셸에서:

```
claude plugin install session-monitor --marketplace heiscool4u/session-monitor
```

`y`로 마켓플레이스를 추가한 뒤 범위(scope)를 고르면 됩니다.

## 사용

세션을 시작하면 패널이 열립니다. 터미널이 좁아서 자동으로 열리지 않으면 `/session-monitor`를 입력하세요.

## 참고

- 목표는 첫 프롬프트에서 가져옵니다. 설치 전에 이미 시작한 세션은 다음 세션부터 채워집니다.
- Bash 등으로 바뀐 파일은 "고친 파일"에 잡히지 않습니다.
- 폭·색·애니메이션 속도는 `hooks/register.tsx` 상단 상수에서 바꿉니다.
- 호버 카드는 마우스 이동을 지원하는 터미널에서만 동작합니다.

## 라이선스

MIT
