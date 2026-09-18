# SuperClaude React

[English](README.md) | 한국어

React 프로젝트에서 바로 쓸 수 있게 만든 Claude Code 스킬 모음입니다.

[SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework)의 명령어와 페르소나 구조가 마음에 들었는데, 범용이다 보니 React 작업에서는 매번 "우리 프로젝트는 Next.js App Router고, 상태는 zustand, 테스트는 vitest야" 같은 설명을 다시 해야 했습니다. 그래서 React에 필요한 것만 추려서 다시 만들었습니다.

스킬을 실행하면 먼저 `package.json`과 설정 파일을 읽어 프로젝트 스택을 파악하고, 그다음 기존 코드의 관례에 맞춰 작업합니다. Next.js, Vite, CRA, Remix, React Native 모두 동작합니다.

## 설치

저장소를 받은 뒤, 적용할 프로젝트 경로를 넘겨서 설치 스크립트를 실행하면 됩니다.

```powershell
git clone https://github.com/<your-org>/superclaude-react.git
cd superclaude-react

# Windows
.\install.ps1 C:\work\my-app -WithMcp

# macOS / Linux / WSL
./install.sh ~/work/my-app --with-mcp
```

프로젝트의 `.claude/` 폴더에 스킬과 에이전트가 복사됩니다. 이 폴더를 커밋해 두면 팀원들은 따로 설치할 필요가 없습니다.

내 PC의 모든 프로젝트에서 쓰고 싶다면 경로 대신 `-Global`(bash는 `--global`)을 주면 `~/.claude`에 설치됩니다.

## 사용법

프로젝트에서 Claude Code를 열고 슬래시 명령으로 호출합니다.

```
/react-analyze src
/react-implement "상태 필터와 페이지네이션이 있는 주문 목록 페이지" --with-tests
/react-troubleshoot "OrderTable에서 Maximum update depth exceeded 에러"
```

명령어를 외울 필요는 없습니다. "LoginForm 테스트 좀 짜줘"라고만 해도 알아서 `react-test`가 선택됩니다. 스킬 본문은 해외 개발자도 쓸 수 있게 영어로 썼지만, 한국어로 요청하면 한국어로 답합니다.

## 스킬

| 스킬 | 하는 일 |
|---|---|
| `react-implement` | 기능, 컴포넌트, 훅 구현. 끝나면 타입 체크, 린트, 테스트까지 돌려봅니다 |
| `react-analyze` | 코드 품질, 구조, 성능, 보안, 접근성을 점검하고 파일:라인 단위로 리포트합니다. 코드는 건드리지 않습니다 |
| `react-improve` | 동작은 그대로 두고 리팩터링합니다. 불필요한 useEffect 제거, 훅 추출, 컴포넌트 분리 같은 작업입니다 |
| `react-test` | 프로젝트에 있는 도구(Vitest, Jest, Testing Library, MSW, Playwright 등)로 테스트를 작성하고 실행합니다 |
| `react-troubleshoot` | 버그를 재현하고, 원인을 확인한 다음에 고칩니다. 추측으로 이것저것 바꾸지 않게 해뒀습니다 |
| `react-markup` | 퍼블리셔가 준 HTML/CSS/jQuery 파일을 React 컴포넌트로 옮깁니다. 아래에서 따로 설명합니다 |
| `react-map` | 코드베이스를 파일당 한 줄로 요약한 인덱스를 캐시해 두고, 스킬들이 소스 트리를 읽는 대신 이 파일을 검색하게 합니다. 모든 스킬이 따르는 토큰 절약 규칙도 여기 있습니다. 아래에서 따로 설명합니다 |
| `react-stack` | 스택 감지용입니다. 다른 스킬이 알아서 먼저 호출하니 직접 쓸 일은 거의 없습니다 |

앞의 다섯 개는 SuperClaude의 `/sc:implement`, `/sc:analyze`, `/sc:improve`, `/sc:test`, `/sc:troubleshoot`에 대응합니다.

SuperClaude처럼 플래그도 받습니다. 자주 쓰는 것만 적으면 이 정도입니다.

- `react-analyze --focus performance`: 특정 영역만 점검
- `react-analyze --depth deep`: 영역별로 에이전트를 나눠서 깊게 분석
- `react-improve --preview`: 바로 고치지 않고 계획만 보여줌
- `react-implement --safe`: 기존 파일을 수정하기 전에 먼저 확인을 받음
- `react-troubleshoot --fix`: 원인이 확인되면 수정까지 진행

나머지는 각 스킬의 `skills/<이름>/SKILL.md`에 있습니다.

## 퍼블리싱 파일을 React로 옮기기

퍼블리셔가 HTML과 CSS를 넘겨주고 개발자가 React로 붙이는 작업을 자주 하다 보니 따로 스킬을 만들었습니다. 원칙은 **퍼블리셔가 짠 마크업과 CSS는 건드리지 않는다**는 것입니다. 클래스명도 그대로 두고, jQuery로 붙어 있던 동작만 React state로 다시 구현합니다.

```
/react-markup ./publish-src
```

이렇게 요청하면 산출물 전체를 훑어서 공통 헤더/푸터, 반복되는 카드 구조, 사용 중인 플러그인, 깨진 이미지 경로를 먼저 정리해 보여줍니다. 그다음 컴포넌트 구성안을 확인받고 변환을 시작합니다. 퍼블리셔가 수정본을 보내면 `--update`를 붙여 바뀐 부분만 반영할 수 있습니다.

변환에 쓰는 스크립트는 Claude 없이도 돌아갑니다(Node 18 이상, 의존성 없음).

```bash
# 산출물 분석
node .claude/skills/react-markup/scripts/scan-markup.mjs ./publish-src

# 헤더만 뽑아서 컴포넌트 파일로 저장
node .claude/skills/react-markup/scripts/html-to-jsx.mjs ./publish-src/html/main.html \
  --select header.header --component Header --asset-base /publish --root ./publish-src \
  --out src/components/Header.tsx
```

Git Bash에서 `--asset-base /publish`처럼 `/`로 시작하는 값을 넘기면 Windows 경로로 바뀌어 버립니다. 이럴 땐 명령 앞에 `MSYS_NO_PATHCONV=1`을 붙이세요. PowerShell에서는 괜찮습니다.

진행 과정, 옵션 전체, 퍼블리셔에게 공유할 체크리스트, 자주 생기는 문제는 [사용 가이드](docs/react-markup.ko.md)에 정리해 두었습니다.

## 토큰 절약

React 작업에서 토큰은 대부분 탐색에 쓰입니다. 뭐가 어디 있는지 찾으려고 폴더를 훑고 파일을 열어보는 과정입니다. `react-map`은 이걸 한 번만 해서 `.claude/cache/react-map.md`에 파일당 한 줄로 적어둡니다.

```
OrderTable.tsx 184 · OrderTable(d) · client query · ←3 T
```

줄 수, export, 태그(`client`, `store`, `query` 등), 이 파일을 import하는 파일 수, 옆에 테스트가 있는지가 들어갑니다. 라우트 목록과 가장 많이 import되는 파일, 가장 큰 파일은 맨 위에 정리됩니다. 다른 스킬은 이 파일부터 검색하고, 실제로 필요한 파일만 엽니다. 소스가 바뀌었을 때만 다시 만들기 때문에 세션이 바뀌어도 그대로 재사용됩니다.

그 밖에 모든 스킬이 따르는 규칙도 이 스킬에 있습니다. 파일은 통째로 읽지 말고 필요한 줄 범위만 읽기, 같은 파일 다시 읽지 않기, 관련된 테스트만 돌리기, 긴 명령 출력은 잘라서 보기, 여러 파일을 훑는 작업은 서브에이전트에 넘기기 같은 것들입니다.

```bash
node .claude/skills/react-map/scripts/build-map.mjs          # 생성/갱신
node .claude/skills/react-map/scripts/build-map.mjs --check  # 최신이면 exit 0
```

`.gitignore`에 `.claude/cache/`를 추가해 두세요.

## 에이전트

SuperClaude의 페르소나 중 React 작업에서 실제로 자주 필요했던 세 개만 서브에이전트로 넣었습니다.

- `react-architect`: 폴더 구조, 상태 관리 방식, 서버/클라이언트 경계 같은 설계 검토
- `react-qa`: 무엇을 어떤 수준에서 테스트할지, 변경의 회귀 위험이 어느 정도인지
- `react-security`: XSS, 클라이언트 번들에 노출된 비밀값, 토큰 저장 방식 등

스킬이 필요할 때 알아서 호출하고, "react-architect 에이전트로 이 구조 검토해줘"처럼 직접 불러도 됩니다.

## MCP 연동 (선택)

없어도 동작하지만, 아래 두 개를 연결해 두면 결과가 확실히 좋아집니다.

- **Context7**: 설치된 라이브러리 버전에 맞는 문서를 찾아봅니다. 버전마다 API가 달라서 생기는 실수가 줄어듭니다.
- **Playwright**: 실제 브라우저를 띄워 UI 버그를 재현하고, E2E 테스트 흐름을 확인하고, 퍼블리싱 원본과 React 화면을 비교합니다.

설치할 때 `-WithMcp`(`--with-mcp`)를 주면 프로젝트에 `.mcp.json`이 만들어집니다. 이미 파일이 있으면 덮어쓰지 않습니다. 직접 설정하는 방법은 [mcp/README.md](mcp/README.md)를 보세요.

## 설치 옵션

| bash | PowerShell | 설명 |
|---|---|---|
| `[경로]` | `[-Target] <경로>` | 설치할 프로젝트. 생략하면 현재 폴더 |
| `--global` | `-Global` | `~/.claude`에 설치 |
| `--skills a,b` | `-Skills a,b` | 원하는 스킬만 설치. `react-` 접두사는 생략 가능 |
| `--no-agents` | `-NoAgents` | 에이전트는 빼고 설치 |
| `--with-mcp` | `-WithMcp` | `.mcp.json` 생성 |
| `--force` | `-Force` | 이미 있는 파일 덮어쓰기 |
| `--uninstall` | `-Uninstall` | 이 저장소가 설치한 파일만 제거 |
| `--dry-run` | `-DryRun` | 실제로 바꾸지 않고 무엇을 할지만 출력 |

업데이트는 이 저장소에서 `git pull` 한 다음 `--force`로 다시 설치하면 됩니다.

## 팀 규칙 넣기

스킬은 전부 평범한 마크다운 파일이라, 설치된 `.claude/skills/`를 열어 고치면 바로 반영됩니다. 팀 컨벤션("export는 named로", "API 훅은 `features/*/api`에" 같은 것)은 `react-stack/SKILL.md`에 적어두는 걸 추천합니다. 모든 스킬이 이 파일을 먼저 읽기 때문입니다.

참고로 프로젝트에 `CLAUDE.md`나 린트 규칙이 있으면 스킬에 적힌 일반적인 가이드보다 그쪽을 우선합니다.

## 저장소 구조

```
superclaude-react/
├── skills/        스킬 8개 (react-markup, react-map에는 스크립트 포함)
├── agents/        서브에이전트 3개
├── docs/          react-markup 사용 가이드
├── mcp/           MCP 설정 예시
├── scripts/       validate.mjs
├── install.sh
└── install.ps1
```

## 기여

스킬을 고치거나 추가할 때 몇 가지만 지켜주세요.

- `skills/`, `agents/`, `mcp/` 안의 내용은 영어로 씁니다. README와 가이드 문서는 한국어판을 따로 둡니다.
- `SKILL.md`가 500줄을 넘으면 세부 내용은 `references/`로 분리합니다.
- 커밋 전에 `node scripts/validate.mjs`를 돌려주세요. 파일 형식, 참조 경로, 언어를 검사합니다.

## 라이선스

[MIT](LICENSE). 구조와 아이디어는 SuperClaude Framework에서 가져왔지만, 이 저장소는 SuperClaude나 Anthropic과 관계없는 개인 프로젝트입니다.
