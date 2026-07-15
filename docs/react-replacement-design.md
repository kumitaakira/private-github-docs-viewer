# React リプレイス設計書

## 目的

現在の Vanilla JS 実装を React ベースへ移行し、UI 状態、GitHub API、キャッシュ、検索、PDF/Markdown 表示を責務ごとに分離する。  
リプレイス後は機能追加や UI 改善を安全に進められるよう、Clean Architecture をベースに依存方向を整理する。

## 採用技術

| 領域 | 採用技術 | 主な役割 |
| --- | --- | --- |
| UI | React | 画面とインタラクション |
| Routing | TanStack Router | ファイルパス、接続先、検索状態の URL 管理 |
| Server State | TanStack Query | GitHub API、PDF/Markdown blob、検索結果の取得状態管理 |
| Client DB | TanStack DB | 接続先一覧、キャッシュメタデータ、ローカル永続データのリアクティブ管理 |
| Form | React Hook Form | 接続先追加/編集フォーム、検索条件フォーム |
| Validation | Zod | フォーム、URL params、local storage/IndexedDB データの検証 |
| Styling | Tailwind CSS | UI スタイルの基本方針 |
| Build | Vite | React アプリのビルド |
| PDF | pdf.js | PDF レンダリング |
| Markdown | markdown-it / KaTeX / DOMPurify | Markdown 表示、数式、サニタイズ |

## アーキテクチャ方針

Clean Architecture の依存方向を守る。

```txt
UI / Framework
  -> Application
    -> Domain

Infrastructure
  -> Application
  -> Domain
```

Domain は React、TanStack、GitHub API、IndexedDB を知らない。  
Application はユースケースを表現する。  
Infrastructure は外部 API や永続化の実装を持つ。  
UI は React コンポーネント、Route、Hook を持つ。

## 推奨ディレクトリ構成

```txt
src/
  app/
    App.tsx
    providers/
      QueryProvider.tsx
      RouterProvider.tsx
      DbProvider.tsx
    routes/
      __root.tsx
      index.tsx
      repository.$profileId.tsx
      repository.$profileId.file.$.tsx

  domain/
    repository/
      RepositoryProfile.ts
      ViewerFile.ts
      RepositoryIndex.ts
    document/
      DocumentType.ts
      MarkdownDocument.ts
      PdfDocument.ts
    cache/
      CachePolicy.ts

  application/
    repository/
      listRepositoryProfiles.ts
      saveRepositoryProfile.ts
      removeRepositoryProfile.ts
      openLastRepository.ts
      loadRepositoryIndex.ts
    document/
      openDocument.ts
      loadMarkdownDocument.ts
      loadPdfDocument.ts
    search/
      searchFiles.ts
      searchMarkdownContent.ts
    cache/
      getPdfFromCache.ts
      savePdfToCache.ts
      prunePdfCache.ts

  infrastructure/
    github/
      GitHubClient.ts
      GitHubRepositoryGateway.ts
    storage/
      repositoryProfileStore.ts
      lastOpenedFileStore.ts
      pdfBlobCache.ts
      repositoryIndexCache.ts
    markdown/
      markdownRenderer.ts
    pdf/
      pdfLoader.ts

  presentation/
    components/
      AppShell/
      RepositoryLibrary/
      RepositoryProfileModal/
      FileExplorer/
      SearchPanel/
      MarkdownViewer/
      PdfViewer/
      LoadingOverlay/
      ShortcutsDialog/
    hooks/
      useRepositoryProfiles.ts
      useOpenDocument.ts
      usePdfZoom.ts
      useCurrentFileSearch.ts
    forms/
      repositoryProfileSchema.ts
      RepositoryProfileForm.tsx

  shared/
    ui/
      Button.tsx
      IconButton.tsx
      Modal.tsx
      SegmentedControl.tsx
    lib/
      bytes.ts
      assertNever.ts
```

## 主要モデル

```ts
type RepositoryProfile = {
  id: string;
  displayName: string;
  repo: string;
  rootPath: string;
  token: string;
  cachePdfBlobs: boolean;
  updatedAt: number;
};

type ViewerFile = {
  name: string;
  path: string;
  sha: string;
  type: 'md' | 'pdf';
};

type OpenDocumentState = {
  profileId: string;
  filePath: string;
  fileType: 'md' | 'pdf';
};
```

Token は現状と同じくローカル保存だが、UI 上は明示的にマスクし、表示切替を行う。将来的に GitHub OAuth や encrypted storage に置き換えられるよう、Domain には保存方式を漏らさない。

## Zod スキーマ

```ts
const repositoryProfileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  repo: z.string().trim().regex(/^[^/\s]+\/[^/\s]+$/),
  rootPath: z.string().trim().default(''),
  token: z.string().trim().min(1),
  cachePdfBlobs: z.boolean().default(false),
});

const routeFileParamsSchema = z.object({
  profileId: z.string().min(1),
  _splat: z.string().min(1),
});
```

Zod はフォームだけでなく、localStorage、IndexedDB、URL params の復元にも使う。

## TanStack Router 設計

URL は「接続先」と「ファイル」を直接表す。

```txt
/                                 接続先ライブラリ
/repository/$profileId            接続先を開いた状態
/repository/$profileId/file/$     ファイルを開いた状態
```

例:

```txt
/repository/kumitaakira_grad-school-exam-prep_/file/過去問/解答/数学/2019システム科学数学解答.md
```

ブラウザバックの対象:

- 接続先切替
- ファイル切替
- ファイル未選択状態
- 検索パネルの基本状態は URL に載せすぎない

## TanStack Query 設計

Query key は profileId と sha/path を含める。

```ts
['repository', profileId]
['repositoryIndex', profileId]
['contents', profileId, path]
['blob', profileId, sha]
['markdownSearch', profileId, query]
```

方針:

- GitHub API は Query で集約
- abort signal は QueryFn から GitHubClient に渡す
- repository index は staleTime を長めにする
- PDF/Markdown blob は必要に応じて IndexedDB cache と組み合わせる
- エラー状態は ErrorBoundary ではなく、ビューごとの回復可能 UI を優先

## TanStack DB 設計

TanStack DB はローカル状態のリアクティブな読み書きに使う。

対象:

- RepositoryProfile 一覧
- ActiveProfile
- LastOpenedFile
- PDF cache metadata
- Repository index cache metadata

IndexedDB に置く大きな binary は TanStack DB の外に置き、metadata だけ DB/collection で扱う。

```ts
repositoryProfilesCollection
lastOpenedFilesCollection
pdfCacheMetadataCollection
repositoryIndexCacheCollection
```

## React Hook Form 設計

接続先追加/編集フォーム:

- `RepositoryProfileModal`
- `useForm({ resolver: zodResolver(repositoryProfileSchema) })`
- token は `type=password/text` を state で切替
- 編集時は `reset(profile)` で明示的に値を流し込む
- 保存成功後に modal close

フォームは一覧の下に出さない。追加/編集は Modal で一覧と明確に分ける。

## キャッシュ設計

### Repository index cache

保存内容:

- file path
- sha
- type
- name
- savedAt
- truncated

保存先:

- 小さいため localStorage または IndexedDB metadata

ポリシー:

- 最大 1MB/entry
- 最大 8 entries
- 6時間で stale
- stale 時は API fetch に失敗した場合の fallback として使う

### PDF blob cache

保存内容:

- ArrayBuffer
- repo/profileId
- path
- sha
- size
- accessedAt

保存先:

- IndexedDB

ポリシー:

- デフォルト OFF
- PC: 100MB
- mobile: 40MB
- LRU 削除
- sha が変われば別キャッシュ
- pruning は保存時、起動時、idle 時に実行

## UI 設計

### Styling

CSS は Tailwind CSS を基本に統一する。

方針:

- コンポーネントの通常スタイルは Tailwind class で記述
- グローバル CSS は最小限にする
- `@layer base/components/utilities` は必要な場合だけ使う
- 独自 CSS が必要な対象は以下に限定する
  - markdown body の外部 CSS 補正
  - pdf.js canvas 周辺の最低限のレイアウト
  - animation keyframes
  - browser default の調整
- 色、spacing、radius、shadow は Tailwind theme に寄せる
- design token 的な値は `tailwind.config.ts` に集約する
- in-component の `style={}` は canvas サイズなど動的値に限定する

避けること:

- Tailwind と独自 CSS の二重管理
- ページ固有 CSS の肥大化
- 色コードの散在
- コンポーネント内の長すぎる className

className が長くなりすぎる場合は、小さな UI component に分解する。

### Repository Library

一覧:

- 1行1カード
- 主表示: displayName
- 副表示: `owner/repo / rootPath`
- 操作:
  - 開く: カード本文クリック
  - 編集: 青系 icon button
  - 削除: 赤系 icon button
  - 追加: 青系 button

並び替え:

- 現時点では実装しない
- React 化後に `dnd-kit` などで実装

### Repository Profile Modal

- 追加/編集は Modal
- displayName
- repo
- rootPath
- token
- token visibility toggle
- PDF cache toggle

### Loading

現状の待機アニメーションを継承する。  
React 版では LoadingOverlay として、GitHub fetch、PDF decode、repository open で共通利用する。

## 既存機能との対応

| 現在 | React 版 |
| --- | --- |
| `docsViewerApp.js` | Route + AppShell + feature hooks |
| `github.js` | `GitHubClient` |
| `repositoryIndex.js` | `loadRepositoryIndex` use case + Query |
| `pdfBlobCache.js` | IndexedDB gateway |
| `repositoryProfiles.js` | TanStack DB collection + storage adapter |
| `lastOpenedFile.js` | TanStack DB collection |
| `currentFileSearch.js` | `useCurrentFileSearch` |
| `pdfZoomController.js` | `usePdfZoom` |
| `markdown/renderer.js` | infrastructure markdown renderer |

## 移行ステップ

1. Vite + React + TypeScript を導入
2. 既存 JS を残したまま `src/` を追加
3. Domain model と Zod schema を先に作る
4. GitHubClient と storage gateway を移植
5. TanStack Query の query key と hooks を作る
6. TanStack Router で URL 構造を実装
7. Repository Library と Profile Modal を React 化
8. FileExplorer を React 化
9. MarkdownViewer を React 化
10. PdfViewer と zoom/search を React 化
11. 既存 `js/` を削除
12. CSS と component API を整理

## 作業分割方針

設計と主要判断はメイン担当が持ち、実装は小さな単位で別エージェントへ委譲する。

メイン担当が保持する判断:

- アーキテクチャ境界
- URL 設計
- GitHub Pages 互換方針
- cache policy
- token の扱い
- UI の情報設計
- 移行完了判定

別エージェントへ渡しやすい単位:

| タスク | 成果物 | 依存 |
| --- | --- | --- |
| Project bootstrap | Vite/React/TS/Tailwind/TanStack 初期構成 | なし |
| Domain model | `domain/` の型と Zod schema | bootstrap |
| GitHub infrastructure | GitHubClient と gateway | domain |
| Storage infrastructure | profile/cache/lastOpened adapters | domain |
| Routing | TanStack Router route tree | domain |
| Repository Library UI | library + profile modal | routing/storage |
| File Explorer UI | tree loading + current file active state | GitHub gateway |
| Markdown Viewer | renderer integration | GitHub gateway |
| PDF Viewer | pdf.js + zoom + virtual rendering | GitHub gateway/cache |
| Search | file/content/current search | repository/document |
| Tests | unit/component/e2e | 各 feature |
| Pages deploy | GitHub Actions + Vite base + fallback | bootstrap/routing |

各エージェントへ渡す時のルール:

- 触る層を限定する
- public API と型を先に確認する
- 既存 Vanilla JS を直接壊さず、React 側で段階的に作る
- token や private repository の情報をログに出さない
- 互換性テストを必ず追加する

## 後方互換性

React リプレイスでは後方互換性を明示的に扱う。特に GitHub Pages と保存済みローカルデータに注意する。

### URL 互換

現行 URL:

```txt
/#/file/<repository-relative-file-path>
```

React Router 移行後の候補:

```txt
/repository/$profileId/file/$
```

互換方針:

- 初回起動時に旧 `#/file/...` を検出する
- active profile がある場合は新 URL へ replace navigate する
- active profile がない場合は接続先ライブラリを表示し、選択後に旧 file path を開く
- 旧 URL を完全に捨てるのは移行後しばらく経ってから

### localStorage 互換

現行キー:

```txt
github_target_repo
github_target_path
github_pat
github_cache_pdf_blobs
github_docs_last_opened_file
github_repository_profiles
github_active_repository_profile
github_docs_repository_index:...
```

互換方針:

- 単一 repository 設定は初回起動で RepositoryProfile に移行
- 既存 `github_repository_profiles` は Zod で parse して不正値を除外
- last opened file は profileId ベースへ移行
- repository index cache は旧キーを読み取り可能にする
- PDF cache は sha/path ベースなので、metadata 移行だけで継続利用できるようにする

### IndexedDB 互換

現行 DB:

```txt
github_docs_pdf_cache
```

互換方針:

- DB 名は維持する
- object store の schema version を上げる場合は migration を書く
- binary を破棄しない
- metadata だけ新構造へ変換する

### GitHub Pages 互換

注意点:

- GitHub Pages の project page は base path が `/private-github-docs-viewer/`
- History API routing は direct access で 404 になりやすい
- 旧 hash URL の利用者がいる可能性がある

方針:

- 初期リリースでは hash routing も候補に残す
- history routing を使うなら `404.html` fallback を必須にする
- PR では Pages source を GitHub Actions に切り替える前提を明記する
- 既存 GitHub Pages の公開停止/切替はユーザー作業として扱う

## テスト方針

優先するテスト:

- Zod schema unit test
- RepositoryProfileStore/TanStack DB adapter test
- PDF cache LRU test
- GitHubClient の error handling test
- route params parse test
- RepositoryProfileModal の form test
- Playwright による主要フロー E2E

推奨ツール:

| 種別 | ツール | 対象 |
| --- | --- | --- |
| Unit | Vitest | domain/application/infrastructure |
| Component | React Testing Library | form, modal, viewer shell |
| E2E | Playwright | 実ブラウザ主要フロー |
| Type | TypeScript | 型安全性 |
| Lint | ESLint | React hooks, import, unused |
| Format | Prettier | フォーマット |

テスト配置:

```txt
src/
  domain/
    repository/
      RepositoryProfile.test.ts
  application/
    cache/
      prunePdfCache.test.ts
  presentation/
    components/
      RepositoryProfileModal.test.tsx

e2e/
  repository-profile.spec.ts
  document-viewer.spec.ts
  pdf-cache.spec.ts
```

テストを書く優先順位:

1. Zod schema と URL params parse
2. GitHubClient のエラー変換
3. PDF cache LRU
4. RepositoryProfile の追加/編集/削除
5. RepositoryProfileModal の token visibility toggle
6. Router navigation
7. PDF/Markdown 表示の E2E

E2E 主要フロー:

- 接続先追加
- 接続先編集
- token visibility toggle
- 接続先切替
- ファイルURL直アクセス
- Markdown表示
- PDF表示
- PDF cache ON/OFF
- ライト/ダークモード

## 開発品質ゲート

### pre-commit

pre-commit は lefthook または husky + lint-staged を使う。  
軽さと設定の見通しを優先するなら lefthook 推奨。

pre-commit で実行するもの:

```txt
eslint --fix
prettier --write
tsc --noEmit
vitest related
```

方針:

- pre-commit は高速なチェックに限定
- Playwright E2E は pre-commit では実行しない
- 失敗したら commit させない
- 自動修正できるものは自動修正する

例:

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: '*.{ts,tsx}'
      run: pnpm eslint --fix {staged_files}
      stage_fixed: true
    format:
      glob: '*.{ts,tsx,css,md,json}'
      run: pnpm prettier --write {staged_files}
      stage_fixed: true
    typecheck:
      run: pnpm typecheck
    test:
      run: pnpm test -- --run
```

package scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

### GitHub Actions

GitHub Actions では Pull Request と main push で品質チェックを行う。

PR で実行:

- install
- lint
- typecheck
- unit/component test
- build

main push で実行:

- install
- lint
- typecheck
- test
- build
- GitHub Pages deploy

## GitHub Pages デプロイ

現在 GitHub Pages を使っている前提で、React/Vite 後も GitHub Actions から `dist/` を Pages にデプロイする。

Vite 設定:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  base: '/private-github-docs-viewer/',
});
```

GitHub Pages Actions 例:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:run
      - run: pnpm build

  deploy:
    if: github.event_name == 'push'
    needs: quality
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

注意:

- GitHub Pages の project page では Vite `base` が必要
- TanStack Router の history mode は GitHub Pages の direct access と相性問題がある
- direct access 対策として 404 fallback を用意する
- あるいは hash history を使う選択肢も残す

Router 方針:

- きれいな URL を優先するなら 404 fallback を整備
- GitHub Pages の制約を優先するなら hash routing
- 現状の `#/file/...` 互換を残すなら hash routing も現実的

## ユーザー対応事項

React リプレイス PR の実装が完了し、GitHub Actions から Pages へデプロイする段階で、ユーザー側の対応が必要。

ユーザーが行うこと:

1. GitHub repository settings を開く
2. Pages の source を確認する
3. 既存の GitHub Pages 公開方式を停止、または `GitHub Actions` source に切り替える
4. 必要であれば custom domain / HTTPS 設定を再確認する

ユーザーが行わなくてよいこと:

- GitHub PAT を Actions secrets に登録すること
- private repository 閲覧用 token をデプロイに含めること
- ローカル IndexedDB/localStorage を手動削除すること

PR 側で明記すること:

- 既存 Pages をいつ止めるか
- Pages source を Actions に切り替えるタイミング
- 旧 URL 互換の検証結果
- localStorage/IndexedDB migration の検証結果

## 注意点

- token を React state に長く保持しすぎない
- URL に token を絶対に載せない
- PDF binary を TanStack Query cache に長時間保持しない
- Query cache と IndexedDB cache の責務を混ぜない
- Domain に React/TanStack の型を入れない
- 接続先一覧と追加/編集フォームは UI として明確に分ける
- 既存の URL hash 形式から新 Router 形式への互換導線を用意する
