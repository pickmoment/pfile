# pfile (AI File Previewer & Manager)

AI 코딩 어시스턴트 및 생성형 AI 워크플로우를 위해 설계된 **Rust + Tauri v2 + React 19** 기반의 초고속 데스크톱 파일 탐색 및 리치 프리뷰어입니다.

방대한 양의 마크다운 문서, 코드 스니펫, 인터랙티브 HTML 프로토타입, 데이터(JSON/CSV), 미디어(SVG/이미지/오디오/비디오), **압축 파일(ZIP/TAR/GZ)**, **EPUB 전자책**을 직관적으로 탐색·관리하고, **내장 Git 소스 컨트롤**, 네이티브 BPE 토큰 수 측정과 원클릭 AI 프롬프트 복사 및 실시간 변경 감지(Hot-reload)를 지원합니다.

---

## ✨ 핵심 기능

### 1. 2패널 인터페이스 & 직관적인 파일 조작
- **좌측 사이드바 (Sidebar)**:
  - **즐겨찾기 (Favorites)**: 자주 찾는 AI 프로젝트 폴더 원클릭 고정 및 전환.
  - **계층형 파일 트리 (FileTree)**: 확장자별 컬러풀 Lucide 아이콘, 접기/펼치기, 드래그 앤 드롭 이동.
  - **컨텍스트 메뉴 & 단축키**: 폴더를 탐색 기준으로 열기, 복사, 잘라내기, 붙여넣기, 인라인 이름변경(`F2`), 안전한 OS 휴지통 삭제(`Del`), 영구 삭제, 탐색기 열기, **Git Stage/Unstage/Discard**.
  - **상단 툴바**: 경로 Breadcrumb 클릭 이동, 실시간 검색 필터(`Ctrl+F`), 카테고리 퀵 탭 (`ALL`, `MD`, `CODE`, `HTML`, `DATA`, `MEDIA`).
- **가변 리사이저블 레이아웃**: 드래그로 사이드바 너비를 조절하며, 사용자 설정이 자동 저장됩니다.

### 2. AI 워크플로우 최적화 리치 뷰어 (Rich Viewers)
- **공통 텍스트 배율 조절**: 상단 뷰어 헤더에서 Markdown, Monaco 코드, JSON/CSV 및 Diff의 글자 크기를 70%~160% 범위로 조절하고 설정을 자동 저장.
- **📝 Markdown Viewer**:
  - GFM 마크다운 완벽 지원 (테이블, 체크리스트, 각주).
  - **YAML Frontmatter 자동 렌더링**: 문서 메타데이터를 작고 정돈된 key/value 표로 표시.
  - 렌더링된 본문과 표의 텍스트 선택·복사 지원.
  - **Mermaid 다이어그램 자동 렌더링** (`graph`, `sequenceDiagram`, `classDiagram`, `flowchart`, `gantt`, `pie` 등).
  - **KaTeX 수식 렌더링** (`$E=mc^2$`, 수식 블록).
  - **3가지 뷰 모드**: [렌더 뷰 | 소스(Monaco) 뷰 | 분할(Split 50:50) 뷰].
  - **목차(TOC) 네비게이션**: 문서 내 헤딩을 파싱하여 원클릭 스크롤 이동.
  - 코드 블록 우측 상단 [Copy Code] 원클릭 복사.
- **💻 Code & Data Viewer**:
  - **Monaco Editor**: 앱의 라이트/다크 테마 자동 동기화, 문법 하이라이팅, 줄 번호, 미니맵, 단어 래핑, 인라인 편집 및 저장(`Ctrl+S`).
  - **JSON 인터랙티브 트리 뷰**: 접고 펼 수 있는 계층형 트리 뷰 + 키/값 검색 + 노드 값 복사.
  - **CSV / TSV 테이블 그리드**: 자동 구분자 감지, 스티키 헤더, 행 필터링 검색.
- **🌐 Interactive Web / HTML Sandbox**:
  - AI가 생성한 단일 HTML/JS/CSS 프로토타입을 격리된 `<iframe>` 샌드박스로 즉시 실행.
  - **디바이스 뷰포트 스위처**: Desktop (100%), Laptop (1024px), Tablet (768px), Mobile (375px).
  - **콘솔 로그 스트립**: `iframe` 내부의 `console.log`, `warn`, `error`를 캡처하여 하단 콘솔에 실시간 표시.
- **🖼️ Image & Media Viewer**:
  - **이미지 뷰어**: 10%~500% 마우스 휠 줌, 클릭 & 드래그 팬(Pan), 투명 배경 체커보드 토글, 1:1 리셋.
  - **SVG 실시간 렌더러**: 벡터 렌더링 뷰 + [SVG XML 소스코드] Monaco 뷰어 토글.
  - **오디오 / 비디오 플레이어**: HTML5 내장 커스텀 미디어 플레이어.
- **⚡ Diff Comparison Viewer**:
  - 두 파일 간 실시간 변경점 비교.
  - **Side-by-Side (2열)** 및 **Unified Inline (단일 열)** 모드 지원.
  - 추가(+)/삭제(-) 라인 하이라이트 및 변경 통계 수치 제공.

- **📦 Archive Viewer (압축 파일 미리보기)**:
  - ZIP, JAR, WAR, APK, WHL, TAR, TAR.GZ, TAR.BZ2, TAR.XZ 등 주요 압축 포맷 지원.
  - **트리형 파일 목록**: 폴더 구조 접기/펼치기, 파일 크기 및 압축률 표시.
  - **검색 필터**: 압축 내부 파일명 실시간 필터링.
  - **개별 파일 미리보기**: 텍스트 파일 즉시 미리보기 (2MB 제한).
  - **전체 추출 (Extract All)**: 지정 폴더에 압축 해제.

- **📖 EPUB Viewer (전자책 리더)**:
  - EPUB2 / EPUB3 전자책 네이티브 렌더링 (외부 앱 없이 내장 뷰어로 열람).
  - **목차 사이드바**: NCX (EPUB2) + NAV (EPUB3) 파싱, 챕터 클릭 이동.
  - **표지 이미지 표시**: 메타데이터에서 커버 이미지 자동 추출.
  - **챕터 네비게이션**: 이전/다음 버튼, 현재 위치 표시.
  - **폰트 크기 조절**: 12~28px 범위 (−/+ 버튼).
  - **이미지 인라인**: 챕터 내 이미지를 base64 data URI로 자동 변환하여 즉시 표시.
  - **내장 CSS 적용**: EPUB 스타일시트를 스코프드 CSS로 적용.

### 3. 🔀 내장 Git 소스 컨트롤
- **`git2` (libgit2) 기반 네이티브 Git 통합**: 외부 `git` CLI 의존 없이 Rust 내장 라이브러리로 동작.
- **자동 Repo 감지**: 현재 디렉토리가 Git 저장소 내부인지 자동 감지하여 UI 활성화.
- **브랜치 & 상태 표시**:
  - 하단 상태바에 현재 브랜치명, detached HEAD 상태, ahead/behind 카운트 표시.
  - 파일 트리 각 파일 옆에 Git 상태 배지 (`M` Modified, `A` Added, `D` Deleted, `?` Untracked, `C` Conflict) — 색상 코딩 (emerald: staged, amber: modified, red: deleted/conflict).
- **GitPanel (사이드바 하단 Source Control 패널)**:
  - **Changes 탭**: Staged / Unstaged 파일 목록, 개별 및 전체 Stage/Unstage, 변경 Discard.
  - **커밋 입력**: 메시지 작성 후 버튼 클릭 또는 `Ctrl+Enter`로 즉시 커밋.
  - **Log 탭**: 최근 50개 커밋 이력 (short ID, 요약, 작성자, 상대 시간).
- **컨텍스트 메뉴 Git 액션**: 파일 우클릭 시 Stage File / Unstage File / Discard Changes 제공.
- **5초 자동 갱신**: Git 상태를 주기적으로 폴링하여 외부 변경사항 자동 반영.

### 4. AI 분석 & 원클릭 컨텍스트 복사
- **🪙 네이티브 BPE 토큰 수 계산**: Rust `tiktoken-rs` 기반 OpenAI `cl100k_base` 토큰 수, 단어 수, 줄 수, 파일 크기 통계 실시간 산출.
- **📋 [Copy for LLM] 원클릭 복사**: 파일 메타데이터(크기, 토큰, 줄 수)와 본문 서식(```lang ... ```)을 AI 프롬프트 입력용 포맷으로 클립보드에 즉시 복사.

### 5. 🟢 실시간 파일 감지 (Hot-Reload)
- Rust `notify-debouncer-mini` 기반 실시간 파일 시스템 감시.
- AI 코딩 어시스턴트(Claude Code, Cursor, Aider, OMP 등)가 디스크의 파일을 생성/수정하는 즉시 뷰어가 자동 갱신됩니다.

---

## ⌨️ 단축키 안내

| 단축키 | 동작 |
| :--- | :--- |
| `Ctrl + P` / `Ctrl + K` | **Quick Jump 커맨드 팔레트** (전체 워크스페이스 고속 파일/폴더 검색 & 즉시 이동) |
| `Ctrl + L` | **주소창(경로) 직접 입력 모드** (임의의 절대/상대 경로 타이핑 및 이동) |
| `Alt + ←` | 이전 경로로 뒤로 가기 (Back) |
| `Alt + →` | 다음 경로로 앞으로 가기 (Forward) |
| `Alt + ↑` | 상위 폴더로 이동 (Up to Parent) |
| `F2` | 선택한 파일 / 폴더 이름 변경 |
| `Delete` | 선택한 항목 삭제 (휴지통 이동 / 영구 삭제 선택) |
| `Ctrl + C` / `Cmd + C` | 파일 시스템 복사 (내부 클립보드) |
| `Ctrl + X` / `Cmd + X` | 파일 시스템 잘라내기 (내부 클립보드) |
| `Ctrl + V` / `Cmd + V` | 복사/잘라낸 항목 현재 디렉토리에 붙여넣기 |
| `Ctrl + F` | 현재 목록 파일 검색 필터 포커스 |
| `Ctrl + H` | **숨김 파일 / 닷파일 표시/숨김 토글** (`.env`, `.gitignore` 등) |
| `F5` / `Ctrl + R` | 워크스페이스 새로고침 |
| `Ctrl + S` | 코드/마크다운 편집 내용 저장 |
| `Esc` | 팝업/모달 닫기 |

---

## 🛠️ 기술 스택

### Backend (Rust & Tauri v2)
- **Tauri v2 (`tauri`, `tauri-build`)**: 데스크톱 창 관리, IPC 커맨드 시스템
- **`tiktoken-rs`**: OpenAI BPE 고속 토크나이저 (cl100k_base)
- **`notify-debouncer-mini`**: 실시간 파일 시스템 변경 감시 및 이벤트 디바운스
- **`trash`**: OS 안전 휴지통 삭제
- **`open`**: 시스템 기본 프로그램 실행
- **`git2`**: libgit2 기반 네이티브 Git 통합 (상태, 스테이징, 커밋, 디프, 로그)
- **`zip`**, **`tar`**, **`flate2`**, **`bzip2`**, **`xz2`**: 압축 파일 읽기, 추출, EPUB 파싱
- **`serde` / `serde_json`**: 직렬화 및 IPC 통신

### Frontend (React 19 & Vite)
- **React 19**, **TypeScript 5.7**, **Vite 6**
- **Tailwind CSS 3.4**: 다크/라이트 테마 전환 및 반응형 레이아웃
- **`zustand`**: 파일 트리, 뷰어 상태, 클립보드, 토스트, Git 상태 전역 관리
- **`@monaco-editor/react`**: VS Code 엔진 기반 코드 뷰어/에디터
- **`react-markdown`**, **`remark-gfm`**, **`remark-math`**, **`rehype-katex`**, **`rehype-raw`**: 마크다운 렌더링
- **`yaml`**: Markdown frontmatter 파싱
- **`mermaid`**: 차트/다이어그램 실시간 렌더링
- **`diff`**: 텍스트 라인 Diff 계산
- **`lucide-react`**: 카테고리별 UI 아이콘

---

## 📁 프로젝트 구조

```
pfile/
├── src-tauri/                 # Rust Tauri v2 백엔드
│   ├── Cargo.toml
│   ├── tauri.conf.json        # Tauri v2 앱 설정
│   ├── build.rs
│   └── src/
│       ├── main.rs
│       ├── lib.rs             # Tauri 커맨드 핸들러 등록
│       ├── state.rs           # AppState (Watcher 채널 관리)
│       └── commands/
│           ├── mod.rs
│           ├── fs_ops.rs      # 파일 CRUD, 휴지통 삭제, 디렉토리 리스팅
│           ├── tokens.rs      # tiktoken-rs 기반 토큰 및 통계 계산
│           ├── watcher.rs     # notify 기반 실시간 파일 감시
│           ├── system.rs      # 탐색기 열기, 기본 앱 실행
│           ├── git.rs         # git2 기반 Git 상태, 스테이징, 커밋, 디프, 로그
│           ├── archive.rs     # 압축 파일 읽기, 개별 추출, 전체 추출
│           └── epub.rs        # EPUB 전자책 파싱 (OPF, NCX/NAV, XHTML 챕터)
├── src/                       # React 19 프론트엔드
│   ├── main.tsx
│   ├── App.tsx                # 레이아웃 통합 및 훅 바인딩
│   ├── index.css              # 다크/라이트 시맨틱 테마 변수
│   ├── types/
│   │   ├── file.ts            # FileMetadata, TokenStats, ViewerMode 등
│   │   └── tauri-events.ts    # WatcherEvent 타입
│   ├── store/
│   │   ├── useFileStore.ts    # 파일 트리, 즐겨찾기, 필터 상태
│   │   ├── useViewerStore.ts  # 뷰어 모드, Diff, 줌, 뷰포트 상태
│   │   ├── useClipboardStore.ts # 파일 복사/잘라내기 버퍼
│   │   ├── useToastStore.ts   # 알림 토스트
│   │   └── useGitStore.ts     # Git 저장소 상태, 스테이징, 커밋, 로그 관리
│   ├── hooks/
│   │   ├── useFileContent.ts  # 파일 텍스트/바이너리 로드 & 캐싱
│   │   ├── useFileWatcher.ts  # 백엔드 Watcher 이벤트 구독 & 자동 갱신
│   │   └── useKeyboardShortcuts.ts # 전역 단축키
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TitleBar.tsx   # 커스텀 타이틀바 & 현재 경로
│   │   │   ├── TopToolbar.tsx # 폴더 열기, Breadcrumb, 검색, 카테고리 탭
│   │   │   ├── SplitLayout.tsx# 좌우 2패널 리사이저블 스플릿
│   │   │   └── StatusBar.tsx  # 하단 실시간 Watcher 상태바
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx    # 사이드바 컨테이너 (Explorer + Git 패널)
│   │   │   ├── Favorites.tsx  # 즐겨찾는 작업 폴더
│   │   │   ├── FileTree.tsx   # 파일 목록 및 모달 관리
│   │   │   ├── FileTreeNode.tsx # 개별 노드 (아이콘, Git 상태 배지, 인라인 수정, D&D)
│   │   │   ├── ContextMenu.tsx# 우클릭 컨텍스트 메뉴 (Git 액션 포함)
│   │   │   └── GitPanel.tsx   # Git Source Control 패널 (Changes/Log 탭)
│   │   ├── viewer/
│   │   │   ├── ViewerContainer.tsx # 카테고리별 뷰어 라우팅
│   │   │   ├── ViewerHeader.tsx    # 토큰 통계, LLM 복사, Diff 버튼
│   │   │   ├── MarkdownViewer.tsx  # GFM, Frontmatter, Mermaid, KaTeX, TOC, 소스/렌더 뷰
│   │   │   ├── CodeViewer.tsx      # Monaco 에디터
│   │   │   ├── HtmlSandbox.tsx     # iframe 샌드박스 웹 프리뷰
│   │   │   ├── DataViewer.tsx      # JSON 트리 뷰 & CSV 테이블 뷰
│   │   │   ├── MediaViewer.tsx     # 이미지(줌/팬), SVG, 오디오/비디오
│   │   │   ├── DiffViewer.tsx      # Side-by-Side / Inline Diff 비교
│   │   │   ├── ArchiveViewer.tsx   # ZIP/TAR 압축 파일 트리뷰 & 추출
│   │   │   ├── EpubViewer.tsx      # EPUB 전자책 리더 (목차, 챕터, 폰트 조절)
│   │   │   └── ExcelViewer.tsx     # Excel/ODS 스프레드시트 뷰어
│   │   └── common/
│   │       ├── Modal.tsx
│   │       ├── Dialogs.tsx    # 생성, 이름변경, 삭제 확인 모달
│   │       └── Toast.tsx
│   └── utils/
│       ├── fileIcons.tsx      # 파일 카테고리별 Lucide 아이콘 매핑
│       ├── formatters.ts      # 크기, 날짜, 언어 ID 포맷팅
│       └── llmPrompt.ts       # LLM 컨텍스트 프롬프트 서식화
├── sample-workspace/          # 테스트 및 시연용 샘플 파일 세트
│   ├── docs/ai_architecture.md
│   ├── demos/interactive_counter.html
│   ├── data/model_metrics.json
│   ├── data/evaluations.csv
│   ├── graphics/badge.svg
│   └── src/tokenizer.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 🚀 시작하기

### 요구 사양
- **Node.js**: v20 이상 또는 **Bun** v1.2 이상
- **Rust**: 1.78 이상 (`rustup default stable`)
- **Tauri v2 CLI**: `@tauri-apps/cli`

### 설치 및 개발 모드 실행

1. **저장소 클론 및 프론트엔드 의존성 설치**:
   ```bash
   bun install
   # 또는 npm install
   ```

2. **Tauri 개발 모드 실행 (Hot-reload 지원)**:
   ```bash
   bun run tauri dev
   # 또는 npm run tauri dev
   ```

3. **단위 테스트 실행**:
   ```bash
   # Rust 백엔드 단위 테스트
   cargo test --manifest-path src-tauri/Cargo.toml

   # 프론트엔드 타입 검사 및 번들 빌드
   bun run build
   ```

### 프로덕션 빌드 (설치형 바이너리 생성)

```bash
bun run tauri build
```
빌드가 완료되면 `src-tauri/target/release/bundle/` 경로에 플랫폼별 설치 파일이 생성됩니다:
- **macOS**: `pfile.app` + `.dmg`
- **Windows**: `.exe` (NSIS 설치 마법사, 한/영 지원)
- **Linux**: `.deb` + `.rpm` + `.AppImage`

---

## 📄 라이선스

MIT License.
