# pfile (AI File Previewer & Manager)

AI 코딩 어시스턴트 및 생성형 AI 워크플로우를 위해 설계된 **Rust + Tauri v2 + React 19** 기반의 초고속 데스크톱 파일 탐색 및 리치 프리뷰어입니다.

방대한 양의 마크다운 문서, 코드 스니펫, 인터랙티브 HTML 프로토타입, 데이터(JSON/CSV), 미디어(SVG/이미지/오디오/비디오)를 직관적으로 탐색·관리하고, 네이티브 BPE 토큰 수 측정과 원클릭 AI 프롬프트 복사 및 실시간 변경 감지(Hot-reload)를 지원합니다.

---

## ✨ 핵심 기능

### 1. 2패널 인터페이스 & 직관적인 파일 조작
- **좌측 사이드바 (Sidebar)**:
  - **즐겨찾기 (Favorites)**: 자주 찾는 AI 프로젝트 폴더 원클릭 고정 및 전환.
  - **계층형 파일 트리 (FileTree)**: 확장자별 컬러풀 Lucide 아이콘, 접기/펼치기, 드래그 앤 드롭 이동.
  - **컨텍스트 메뉴 & 단축키**: 복사, 잘라내기, 붙여넣기, 인라인 이름변경(`F2`), 안전한 OS 휴지통 삭제(`Del`), 영구 삭제, 탐색기 열기.
  - **상단 툴바**: 경로 Breadcrumb 클릭 이동, 실시간 검색 필터(`Ctrl+F`), 카테고리 퀵 탭 (`ALL`, `MD`, `CODE`, `HTML`, `DATA`, `MEDIA`).
- **가변 리사이저블 레이아웃**: 드래그로 사이드바 너비를 조절하며, 사용자 설정이 자동 저장됩니다.

### 2. AI 워크플로우 최적화 리치 뷰어 (Rich Viewers)
- **📝 Markdown Viewer**:
  - GFM 마크다운 완벽 지원 (테이블, 체크리스트, 각주).
  - **Mermaid 다이어그램 자동 렌더링** (`graph`, `sequenceDiagram`, `classDiagram`, `flowchart`, `gantt`, `pie` 등).
  - **KaTeX 수식 렌더링** (`$E=mc^2$`, 수식 블록).
  - **3가지 뷰 모드**: [렌더 뷰 | 소스(Monaco) 뷰 | 분할(Split 50:50) 뷰].
  - **목차(TOC) 네비게이션**: 문서 내 헤딩을 파싱하여 원클릭 스크롤 이동.
  - 코드 블록 우측 상단 [Copy Code] 원클릭 복사.
- **💻 Code & Data Viewer**:
  - **Monaco Editor**: 문법 하이라이팅, 줄 번호, 미니맵, 단어 래핑, 인라인 편집 및 저장(`Ctrl+S`).
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

### 3. AI 분석 & 원클릭 컨텍스트 복사
- **🪙 네이티브 BPE 토큰 수 계산**: Rust `tiktoken-rs` 기반 OpenAI `cl100k_base` 토큰 수, 단어 수, 줄 수, 파일 크기 통계 실시간 산출.
- **📋 [Copy for LLM] 원클릭 복사**: 파일 메타데이터(크기, 토큰, 줄 수)와 본문 서식(```lang ... ```)을 AI 프롬프트 입력용 포맷으로 클립보드에 즉시 복사.

### 4. 🟢 실시간 파일 감지 (Hot-Reload)
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
- **`serde` / `serde_json`**: 직렬화 및 IPC 통신

### Frontend (React 19 & Vite)
- **React 19**, **TypeScript 5.9**, **Vite 6**
- **Tailwind CSS 3.4**: 모던 다크 테마 및 반응형 레이아웃
- **`zustand`**: 파일 트리, 뷰어 상태, 클립보드, 토스트 전역 상태 관리
- **`@monaco-editor/react`**: VS Code 엔진 기반 코드 뷰어/에디터
- **`react-markdown`**, **`remark-gfm`**, **`remark-math`**, **`rehype-katex`**, **`rehype-raw`**: 마크다운 렌더링
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
│           └── system.rs      # 탐색기 열기, 기본 앱 실행
├── src/                       # React 19 프론트엔드
│   ├── main.tsx
│   ├── App.tsx                # 레이아웃 통합 및 훅 바인딩
│   ├── index.css              # 다크 테마 및 타이포그래피
│   ├── types/
│   │   ├── file.ts            # FileMetadata, TokenStats, ViewerMode 등
│   │   └── tauri-events.ts    # WatcherEvent 타입
│   ├── store/
│   │   ├── useFileStore.ts    # 파일 트리, 즐겨찾기, 필터 상태
│   │   ├── useViewerStore.ts  # 뷰어 모드, Diff, 줌, 뷰포트 상태
│   │   ├── useClipboardStore.ts # 파일 복사/잘라내기 버퍼
│   │   └── useToastStore.ts   # 알림 토스트
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
│   │   │   ├── Sidebar.tsx    # 사이드바 컨테이너
│   │   │   ├── Favorites.tsx  # 즐겨찾는 작업 폴더
│   │   │   ├── FileTree.tsx   # 파일 목록 및 모달 관리
│   │   │   ├── FileTreeNode.tsx # 개별 노드 (아이콘, 인라인 수정, 드래그앤드롭)
│   │   │   └── ContextMenu.tsx# 우클릭 컨텍스트 메뉴
│   │   ├── viewer/
│   │   │   ├── ViewerContainer.tsx # 카테고리별 뷰어 라우팅
│   │   │   ├── ViewerHeader.tsx    # 토큰 통계, LLM 복사, Diff 버튼
│   │   │   ├── MarkdownViewer.tsx  # GFM, Mermaid, KaTeX, TOC, 소스/렌더 뷰
│   │   │   ├── CodeViewer.tsx      # Monaco 에디터
│   │   │   ├── HtmlSandbox.tsx     # iframe 샌드박스 웹 프리뷰
│   │   │   ├── DataViewer.tsx      # JSON 트리 뷰 & CSV 테이블 뷰
│   │   │   ├── MediaViewer.tsx     # 이미지(줌/팬), SVG, 오디오/비디오
│   │   │   └── DiffViewer.tsx      # Side-by-Side / Inline Diff 비교
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
빌드가 완료되면 `src-tauri/target/release/bundle/` 경로에 Windows `.msi` / `.exe` 설치 파일이 생성됩니다.

---

## 📄 라이선스

MIT License.
