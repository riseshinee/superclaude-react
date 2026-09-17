# react-markup 사용 가이드

[English](react-markup.md) | 한국어

퍼블리셔에게 받은 HTML, CSS, jQuery 파일을 React 컴포넌트로 옮길 때 쓰는 스킬입니다.

가장 중요한 원칙은 **퍼블리셔가 만든 마크업과 CSS를 바꾸지 않는 것**입니다. 퍼블리싱 CSS는 `.gnb > li.on > a` 같은 선택자에 기대고 있어서, 태그 구조나 클래스명을 조금만 바꿔도 화면이 깨집니다. 그래서 이 스킬은 마크업을 그대로 JSX로 옮기고, jQuery로 붙어 있던 동작만 React state로 다시 구현합니다.

반대로 이런 경우에는 맞지 않습니다.

- HTML 없이 Figma 시안만 있는 경우 → `react-implement`를 쓰세요.
- 퍼블리싱 CSS를 Tailwind나 CSS Modules로 바꾸고 싶은 경우 → 이 스킬은 CSS를 일부러 건드리지 않습니다.

## 설치

Claude Code와 Node.js 18 이상이 필요합니다. 원본과 React 화면을 비교하는 단계까지 하려면 Playwright MCP도 연결해 두세요([설정 방법](../mcp/README.md)).

이 저장소를 받은 폴더에서 설치 스크립트를 실행합니다.

```powershell
# 특정 프로젝트에 설치
.\install.ps1 C:\work\my-app -Skills markup

# 내 PC의 모든 프로젝트에서 사용
.\install.ps1 -Global -Skills markup
```

macOS, Linux, WSL, Git Bash에서는 `./install.sh ~/work/my-app --skills markup`, `./install.sh --global --skills markup`처럼 씁니다.

`react-markup`을 설치하면 프레임워크 감지에 쓰는 `react-stack`도 같이 들어갑니다. 다른 스킬도 함께 쓰려면 `--skills markup,implement,test`처럼 이어서 적으면 됩니다.

## 산출물은 어디에 두나

받은 파일은 손대지 말고 프로젝트 안에 그대로 넣어 두세요. 폴더 이름은 뭐든 괜찮은데, 여기서는 `publish-src/`로 하겠습니다.

```
my-app/
├── publish-src/        퍼블리셔에게 받은 그대로
│   ├── html/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── fonts/
├── public/
├── src/
└── package.json
```

이 폴더는 커밋해 두는 게 좋습니다. 나중에 수정본이 오면 무엇이 바뀌었는지 git으로 바로 비교할 수 있습니다.

## 진행 과정

### 요청하기

프로젝트에서 Claude Code를 열고 이렇게 요청합니다.

```
/react-markup ./publish-src
```

"publish-src에 있는 퍼블리싱 파일 리액트로 옮겨줘"처럼 말로 해도 됩니다. 페이지 일부만 하고 싶으면 `--pages main.html,about.html`을 붙이세요.

### 스캔 결과 확인

Claude는 먼저 산출물 전체를 훑고 결과를 요약해 줍니다. 대략 이런 내용이 나옵니다.

```
Layout candidates
  header.header   12페이지  only on/active classes differ
  footer#footer   12페이지  identical

Repeated structures
  ul.card-list > li.card   최대 8개, 3페이지

Libraries: jquery, swiper
Breakpoints: 768px, 1024px

Broken local references
  images/main/bg.jpg ← html/main.html
```

- **Layout candidates:** 여러 페이지에 공통으로 들어가는 블록입니다. 헤더처럼 "활성 메뉴 클래스만 다르다"고 나오면, 컴포넌트는 하나로 만들고 현재 경로에 따라 `on` 클래스를 붙이게 됩니다.
- **Repeated structures:** 같은 구조가 반복되는 곳입니다. 데이터 배열과 `.map()`으로 바뀝니다.
- **Broken local references:** HTML이나 CSS가 가리키는데 실제로는 없는 파일입니다. 이게 보이면 작업을 더 진행하기 전에 퍼블리셔에게 파일을 받는 게 좋습니다.
- **Libraries:** 목록에 있는 플러그인은 React용으로 바꿔야 합니다. 새 패키지를 설치하기 전에는 Claude가 먼저 물어봅니다.

### 컴포넌트 구성안 확인

코드를 쓰기 전에 어떻게 나눌지 먼저 보여줍니다.

```
Layout
  Header   ← header.header (활성 메뉴는 현재 경로로 판단)
  Footer   ← footer#footer
Pages
  /        ← html/main.html   MainVisual(Swiper), CardList, Tabs
  /about   ← html/sub/about.html
Behavior
  모바일 메뉴 토글 → useState + open 클래스
  탭 → 선택된 인덱스를 state로
  Swiper → swiper/react 설치 필요 (진행할까요?)
```

페이지가 5개를 넘으면 이 단계에서 확인을 받고, 몇 페이지씩 나눠서 작업합니다. 방향을 바꾸려면 지금이 가장 쉽습니다. 컴포넌트 이름이나 분리 단위가 마음에 들지 않으면 여기서 말해 주세요.

### 변환과 동작 옮기기

구성안이 정해지면 블록마다 변환 스크립트를 돌리고, 결과를 다듬습니다.

- 구성안대로 컴포넌트를 나눕니다.
- 반복되는 항목은 데이터 배열로 뽑고 `.map()`으로 렌더링합니다.
- `.html`로 가는 링크는 라우터 링크로 바꿉니다.
- `href="#"`로 만든 버튼 역할 링크는 `<button type="button">`으로 바꿉니다. 클래스는 그대로 둡니다.
- jQuery 동작은 React state로 다시 만듭니다. CSS가 기대하는 `on`, `active`, `open` 같은 클래스 이름은 유지합니다.

jQuery 패턴별로 어떻게 바꾸는지는 [jquery-to-react.md](../skills/react-markup/references/jquery-to-react.md)에 정리돼 있습니다.

### 검증

타입 체크, 린트, 빌드를 돌립니다. Playwright MCP가 연결돼 있으면 퍼블리싱 원본과 React 페이지를 스캔에서 찾은 브레이크포인트별로 캡처해서 비교하고, 탭이나 메뉴 같은 인터랙션도 실제로 눌러 봅니다.

마지막으로 만든 파일과 남은 이슈(빠진 이미지, 아직 못 옮긴 플러그인, 화면 차이 등)를 정리해 줍니다.

## CSS와 이미지는 어디로 가나

기본값은 퍼블리싱 파일을 **그대로 `public/publish/`에 복사**하는 방식입니다.

```
public/publish/css/
public/publish/images/
public/publish/fonts/
```

CSS와 이미지의 상대 위치가 그대로라서, CSS 안의 `url(../images/bg.png)`도 수정 없이 동작합니다. JSX 안의 이미지 경로는 `/publish/images/...`로 바뀝니다. 수정본이 오면 이 폴더만 덮어쓰면 되니 관리도 편합니다.

CSS는 앱 전체에서 한 번만 불러옵니다.

- **Vite, CRA:** `index.html`의 `<head>`에 `<link rel="stylesheet" href="/publish/css/common.css">`를 넣습니다.
- **Next.js App Router:** `app/layout.tsx`의 `<head>`에 같은 `<link>`를 넣습니다.
- **Next.js Pages Router:** `pages/_document.tsx`의 `<Head>`에 넣습니다.

프로젝트가 이미 CSS를 번들러로 관리하고 있다면 `--assets bundle`을 쓰세요. CSS는 `src/styles/`로 옮겨 import하고, 이미지는 import하거나 `public/`으로 옮깁니다. 파일 위치가 바뀌니 CSS의 `url()` 경로를 손봐야 할 수 있습니다.

어느 방식이든 **퍼블리싱 CSS를 CSS Modules로 불러오면 안 됩니다.** 클래스명이 해시로 바뀌어서 선택자가 전부 깨집니다.

## 수정본을 받았을 때

1. `publish-src/`에 새 파일을 덮어씁니다. `git diff -- publish-src/`로 무엇이 바뀌었는지 볼 수 있습니다.
2. `/react-markup ./publish-src --update`를 실행합니다.
3. Claude가 바뀐 블록만 찾아 해당 컴포넌트에 반영합니다. 그동안 추가한 state나 이벤트 핸들러는 그대로 둡니다.
4. `public/publish/`의 CSS와 이미지도 새 버전으로 교체합니다.
5. 영향받은 페이지를 다시 화면 비교합니다.

## 스크립트 직접 쓰기

변환에 쓰는 스크립트 두 개는 Claude 없이도 실행됩니다. Node 18 이상만 있으면 되고 설치할 의존성은 없습니다. 프로젝트에 설치했다면 `.claude/skills/react-markup/scripts/`에, 전역으로 설치했다면 `~/.claude/skills/react-markup/scripts/`에 있습니다.

### scan-markup.mjs

산출물 폴더를 분석해서 앞에서 본 스캔 결과를 출력합니다.

```bash
node .claude/skills/react-markup/scripts/scan-markup.mjs ./publish-src
```

페이지 목록, 공통 레이아웃 후보, 반복 구조, 사용 중인 라이브러리와 jQuery 패턴 수, CSS 크기와 브레이크포인트, 깨진 참조를 보여줍니다. 다른 도구에서 쓰려면 `--json`을 붙이세요.

### html-to-jsx.mjs

HTML을 JSX로 바꿉니다. 기본은 `<body>` 전체를 변환하고, `--select`로 원하는 블록만 뽑을 수 있습니다.

```bash
S=.claude/skills/react-markup/scripts

# 페이지 전체 변환
node $S/html-to-jsx.mjs publish-src/html/main.html

# 헤더만 뽑아서 컴포넌트 파일로 저장 (이미지 경로도 /publish/... 로 변경)
node $S/html-to-jsx.mjs publish-src/html/main.html --select header.header \
  --component Header --asset-base /publish --root publish-src \
  --out src/components/layout/Header.tsx

# 리스트 안의 항목만 변환
node $S/html-to-jsx.mjs publish-src/html/main.html --select .card-list --inner

# 복사해 둔 HTML 조각 변환
cat snippet.html | node $S/html-to-jsx.mjs -
```

| 옵션 | 설명 |
|---|---|
| `--select <선택자>` | 처음 일치하는 요소만 변환. `tag`, `#id`, `.class`, `tag.class` 형태만 됩니다 |
| `--inner` | 선택한 요소는 빼고 안쪽만 변환 |
| `--component <이름>` | `export function 이름() { ... }`으로 감쌈 |
| `--asset-base <경로>` | 이미지 같은 상대경로를 `<경로>/...` 절대경로로 바꿈 |
| `--root <폴더>` | `--asset-base`의 기준이 되는 폴더. 보통 산출물 최상위 폴더를 줍니다 |
| `--ts` | TypeScript용으로 출력. `--out`이 `.tsx`면 자동 적용 |
| `--out <파일>` | 파일로 저장. 이미 있으면 `--force`를 줘야 덮어씁니다 |
| `--json` | 결과와 노트를 JSON으로 출력 |
| `--quiet` | 변환 노트를 출력하지 않음 |

JSX 문법에 맞추는 변환은 알아서 처리합니다. 예를 들면 이런 것들입니다.

```html
<label for="q" class="tit">검색</label>
<input id="q" value="hello" maxlength="20" readonly>
<div style="margin-top:10px; --gap:8px" onclick="openLayer()"></div>
```

```tsx
<label htmlFor="q" className="tit">검색</label>
<input id="q" defaultValue="hello" maxLength={20} readOnly />
<div style={{ marginTop: "10px", "--gap": "8px" } as React.CSSProperties} /* TODO(markup): onclick="openLayer()" */ />
```

이 밖에도 SVG 속성, `<select>`의 선택값, `<textarea>` 내용, `<pre>`의 공백, 빠진 `<tbody>`, 텍스트 안의 `{` `}` 같은 것들을 처리합니다. `<script>`와 `<style>`은 제거되고, `onclick` 같은 인라인 핸들러는 위처럼 `TODO(markup)` 주석으로 남습니다.

변환이 끝나면 직접 처리해야 할 항목이 노트로 출력됩니다. 인라인 핸들러, 제거된 스크립트, 라우터 링크로 바꿔야 할 `.html` 링크, `alt`가 빠진 이미지 같은 것들입니다. 노트의 항목을 하나씩 처리하고 `TODO(markup)` 주석을 지우면 됩니다.

**Git Bash 사용 시 주의:** Git Bash는 `/`로 시작하는 인자를 Windows 경로로 바꿔 버립니다. `--asset-base /publish`가 `C:/Program Files/Git/publish`가 되는 식입니다. 명령 앞에 `MSYS_NO_PATHCONV=1`을 붙이면 됩니다. 스크립트가 이 상황을 감지해서 안내해 주고, PowerShell에서는 문제가 없습니다.

## 퍼블리셔와 미리 맞춰두면 좋은 것

산출물이 아래 내용을 지키면 변환이 훨씬 빠르고 결과도 정확합니다. 작업 시작 전에 퍼블리셔와 공유해 두세요.

- 헤더, 푸터, 메뉴 마크업은 활성 클래스(`on`, `active`)만 빼고 모든 페이지에서 똑같이
- 상태 변화는 인라인 `style`이 아니라 클래스(`.on`, `.active`, `.open`)로
- 카드나 리스트처럼 반복되는 항목은 같은 구조와 클래스로
- 인터랙션 코드는 인라인 `onclick` 대신 JS 파일에
- 링크가 아닌 클릭 요소는 `<button type="button">`으로, 링크에는 실제 주소를
- 모든 이미지에 `alt` (꾸밈용 이미지는 `alt=""`)
- 이미지와 폰트 경로는 상대경로로, 참조하는 파일은 빠짐없이
- 사용한 플러그인과 버전 적어주기 (예: Swiper 11)
- 수정본은 파일 전체로, 무엇을 바꿨는지 간단한 메모와 함께

## 자주 생기는 문제

**스타일이 하나도 안 먹어요.**
스타일시트를 불러오지 않았거나 경로가 틀린 경우입니다. 브라우저에서 `/publish/css/common.css`를 직접 열어 보세요.

**일부 스타일만 깨져요.**
CSS를 CSS Modules로 불러와서 클래스명이 바뀌었거나, 컴포넌트를 나누는 과정에서 감싸는 `div`가 추가돼 `.a > .b` 같은 선택자가 안 맞게 된 경우가 많습니다. 원본 HTML과 DOM 구조를 비교해 보세요.

**이미지가 404가 나요.**
`--asset-base`와 `--root`가 맞지 않는 경우입니다. `--root`에는 `public/publish/`로 복사한 폴더의 원래 위치(보통 `publish-src`)를 줘야 합니다.

**`a`를 `button`으로 바꿨더니 모양이 달라졌어요.**
브라우저 기본 버튼 스타일 때문입니다. 해당 클래스에 `background: none; border: 0; padding: 0; font: inherit; color: inherit;`를 추가하세요.

**`Unsupported selector "ul > li"` 에러가 나요.**
`--select`는 단순한 선택자만 지원합니다. `--select .card-list --inner`처럼 부모를 선택하고 안쪽을 변환하세요.

**`Refusing to overwrite` 에러가 나요.**
`--out`으로 지정한 파일이 이미 있어서입니다. 덮어써도 된다면 `--force`를 붙이세요.

**`--gap` 같은 CSS 변수가 있는 style에서 타입 에러가 나요.**
`--ts`를 붙이거나 `--out`을 `.tsx` 파일로 지정하면 타입 캐스팅이 들어갑니다.

**슬라이더나 플러그인이 동작하지 않아요.**
퍼블리셔의 플러그인 스크립트는 일부러 불러오지 않습니다. [jquery-to-react.md](../skills/react-markup/references/jquery-to-react.md)에 있는 React용 대체 라이브러리로 옮겨야 합니다.

**Next.js에서 hydration 경고가 나요.**
렌더링 중에 `window`에 접근하는 플러그인 코드가 있을 때 생깁니다. 해당 코드를 `useEffect` 안으로 옮기거나 `next/dynamic`에 `ssr: false`로 불러오세요.

## 한계

- `--select`는 단순 선택자만 되고, 여러 개가 일치하면 첫 번째만 변환합니다.
- 파서가 웬만한 실수는 받아주지만 브라우저만큼 완벽하지는 않습니다. 마크업이 심하게 깨져 있으면 결과 구조가 달라질 수 있으니 화면으로 꼭 비교하세요.
- 스크립트는 HTML을 JSX로 바꾸는 데까지만 합니다. 컴포넌트 분리, jQuery 동작 옮기기, 화면 비교는 Claude가 스킬 문서에 따라 진행합니다.
- 텍스트와 목록 데이터는 하드코딩된 상태로 남습니다. 실제 API 연결은 `react-implement`로 따로 진행하세요.
