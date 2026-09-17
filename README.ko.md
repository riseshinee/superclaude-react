# SuperClaude React

[English](README.md) | **한국어**

[SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework)를 모델로 만든 React 전용 [Claude Code](https://claude.com/claude-code) 스킬·에이전트 모음입니다.
어떤 React 프로젝트에든 복사해 넣으면 Claude가 스택(Next.js, Vite, CRA, Remix, React Native 등)을 감지하고 그 프로젝트의 관례를 따라 작업합니다.

- **스킬 6개** — SuperClaude 핵심 명령(`/sc:implement`, `/sc:analyze`, `/sc:improve`, `/sc:test`, `/sc:troubleshoot`)을 React용으로 재작성 + 공통 스택 감지 스킬
- **에이전트 3개** — SuperClaude 페르소나를 Claude Code 서브에이전트로 구성 (아키텍트, QA, 보안)
- **스택 감지** — 모든 스킬이 먼저 실행하는 의존성 없는 스크립트. 일반론이 아니라 프로젝트에 맞는 결과를 냄
- **MCP 가이드** — Context7, Playwright 설정

> 스킬 본문은 전 세계 개발자가 쓸 수 있도록 영어로 작성되어 있습니다. 한국어로 요청해도 정상적으로 동작하며, Claude는 요청한 언어로 답합니다.

## 빠른 시작

```bash
git clone https://github.com/<your-org>/superclaude-react.git
cd superclaude-react

# macOS / Linux / WSL / Git Bash
./install.sh ~/work/my-react-app --with-mcp

# Windows PowerShell
.\install.ps1 C:\work\my-react-app -WithMcp
```

프로젝트에서 Claude Code를 열고:

```
/react-analyze src
/react-implement "상태 필터와 페이지네이션이 있는 주문 목록 페이지" --with-tests
/react-troubleshoot "OrderTable에서 Maximum update depth exceeded 에러"
```

슬래시 명령 없이 *"LoginForm 테스트 작성해줘"* 처럼 자연어로 요청해도 해당 스킬(`react-test`)이 자동으로 선택됩니다.

## 스킬

| 스킬 | SuperClaude | 역할 |
|---|---|---|
| `react-stack` | — | 프레임워크, React 버전, 상태·스타일·테스트 도구, 구조, 실행 명령 감지. 다른 모든 스킬이 먼저 사용 |
| `react-implement` | `/sc:implement` | 감지된 관례에 맞춰 기능·컴포넌트·훅 구현, typecheck/lint/test로 검증 |
| `react-analyze` | `/sc:analyze` | 품질·아키텍처·성능·보안·접근성 리포트 (파일:라인 근거). 코드 수정 안 함 |
| `react-improve` | `/sc:improve` | 동작 보존 리팩터링: 불필요한 effect 제거, 훅 추출, 컴포넌트 분리, 상태 구조 정리 |
| `react-test` | `/sc:test` | Testing Library, MSW, Playwright/Cypress 등 프로젝트 도구로 동작 중심 테스트 |
| `react-troubleshoot` | `/sc:troubleshoot` | 재현 → 원인 확정 → 수정 → 검증. React 증상 사전 포함 |

### 플래그

스킬은 SuperClaude 스타일 플래그를 인자로 받습니다.

| 플래그 | 스킬 | 효과 |
|---|---|---|
| `--focus <영역>` | analyze | 범위 한정 (quality, architecture, performance, security, a11y) |
| `--depth deep` | analyze | 영역별로 페르소나 에이전트에 병렬 위임 |
| `--safe` | implement, improve | 계획 먼저 승인 / 리팩터링 전 특성화 테스트 추가 |
| `--with-tests` | implement | 테스트 함께 작성 |
| `--preview` | improve | 코드 수정 없이 계획만 제시 |
| `--fix` | troubleshoot | 원인 확정 후 바로 수정 |

전체 목록은 각 `skills/<name>/SKILL.md`를 참고하세요.

## 에이전트 (페르소나)

| 에이전트 | SuperClaude 페르소나 | 용도 |
|---|---|---|
| `react-architect` | architect / frontend | 구조, 상태 전략, 서버/클라이언트 경계, 설계·리팩터링 검토 |
| `react-qa` | qa | 테스트 전략, 회귀 위험, flaky 테스트 |
| `react-security` | security | XSS, 비밀값 노출, 토큰 저장, RSC/Server Action 유출 |

스킬이 필요할 때 에이전트에 위임하며(예: `react-analyze --depth deep`), 직접 호출할 수도 있습니다: *"react-architect 에이전트로 이 설계 검토해줘"*

## MCP 서버 (선택, 권장)

| 서버 | 개선되는 점 |
|---|---|
| Context7 | 구현 시 버전에 맞는 라이브러리 문서 참조 |
| Playwright | 실제 브라우저로 E2E 흐름 탐색, UI 버그 재현 |

`--with-mcp` / `-WithMcp`는 프로젝트에 `.mcp.json`을 생성합니다(기존 파일은 덮어쓰지 않음. PowerShell 설치기는 Windows에 필요한 `cmd /c` 래퍼를 자동 추가). 수동 설정은 [mcp/README.md](mcp/README.md) 참고.

## 설치 옵션

| bash | PowerShell | 설명 |
|---|---|---|
| `[TARGET_DIR]` | `[-Target] <dir>` | 설치할 프로젝트 (기본: 현재 디렉터리) |
| `--global` | `-Global` | `~/.claude`에 설치해 모든 프로젝트에서 사용 |
| `--skills a,b` | `-Skills a,b` | 일부 스킬만 설치 (`react-` 접두사 생략 가능, `react-stack`은 항상 포함) |
| `--no-agents` | `-NoAgents` | 에이전트 제외 |
| `--with-mcp` | `-WithMcp` | `.mcp.json` 생성 |
| `--force` | `-Force` | 기존 스킬/에이전트 덮어쓰기 (업데이트 시 사용) |
| `--uninstall` | `-Uninstall` | 이 저장소가 배포한 파일만 제거 |
| `--dry-run` | `-DryRun` | 변경 없이 수행 내용만 출력 |

**프로젝트 설치 vs 전역 설치:** `.claude/`를 커밋하면 팀 전체가 같은 버전의 스킬을 프로젝트별로 고정해 사용할 수 있습니다. 개인적으로 모든 프로젝트에서 쓰려면 `--global`을 사용하세요.

**업데이트:** 이 저장소에서 `git pull` 후 `--force`로 설치기를 다시 실행합니다.

## 팀에 맞게 커스터마이즈

스킬은 일반 Markdown 파일입니다. 설치된 `.claude/skills/` 사본을 수정해 팀 규칙을 반영하세요.

- `react-stack/SKILL.md`에 팀 관례 추가 (예: "항상 named export", "API 훅은 `features/*/api`에 위치")
- `react-stack/references/frameworks.md`에 스택별 규칙 추가

프로젝트의 `CLAUDE.md`와 lint 설정은 항상 스킬의 일반 가이드보다 우선합니다.

## 저장소 구조

```
superclaude-react/
├── skills/
│   ├── react-stack/          # scripts/detect-stack.mjs, references/frameworks.md
│   ├── react-implement/
│   ├── react-analyze/
│   ├── react-improve/
│   ├── react-test/
│   └── react-troubleshoot/
├── agents/                   # react-architect, react-qa, react-security
├── mcp/                      # mcp.example.json, README.md
├── scripts/validate.mjs      # 구조·frontmatter·참조 검사
├── install.sh
└── install.ps1
```

## 기여하기

1. 배포되는 콘텐츠(`skills/`, `agents/`, `mcp/`)는 영어로 작성합니다.
2. `SKILL.md`는 500줄 이하로 유지하고, 상세 내용은 `references/`로 분리합니다.
3. 커밋 전 `node scripts/validate.mjs`를 실행합니다 (frontmatter, 이름, 참조 파일, 언어 검사).
4. 감지기는 실제 프로젝트로 테스트합니다: `node skills/react-stack/scripts/detect-stack.mjs <path>`

## 요구 사항

- Claude Code
- Node.js 18+ (스택 감지 스크립트, MCP 서버)

## 감사의 말

구조와 명령/페르소나 개념은 [SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework)에서 가져왔습니다. 이 프로젝트는 SuperClaude 및 Anthropic과 무관한 독립 프로젝트입니다.

## 라이선스

[MIT](LICENSE)
