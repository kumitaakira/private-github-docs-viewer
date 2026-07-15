# RepoShelf

[![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=fff)](https://vite.dev/)
[![License](https://img.shields.io/badge/license-MIT-8b5cf6)](LICENSE)

プライベートリポジトリに置いたMarkdownとPDFを、読みやすい文書棚として開くためのReactアプリです。

GitHubはコードと文書の保管場所として便利ですが、スマホではプライベートリポジトリ内のPDFをその場で快適に読めないことがあります。

RepoShelfは、その不便を補うための「プライベート文書の閲覧面」です。

- MarkdownとPDFを同じ画面で閲覧
- ファイル名、パス、Markdown本文、現在のファイル内検索
- 複数リポジトリの接続先保存
- ライト/ダークテーマ
- 日本語/英語UI切り替え

## Landing Page

リッチな紹介ページは、GitHub Pages上では次のURLで公開されます。

https://kumitaakira.github.io/private-github-docs-viewer/landing.html

## Getting Started

```bash
npm install
npm run dev
```

1. `owner/repo` と Personal Access Token を入力します。
2. MarkdownまたはPDFを選びます。
3. 検索、テーマ切り替え、PDFズームを使いながら読み進めます。

> Personal Access Tokenはブラウザのローカルストレージに保存されます。共有端末では、使用後に接続先を削除してください。

## Development

```bash
npm run typecheck
npm run test:run
npm run build
```

主な技術スタックは、React、TypeScript、Vite、TanStack Query、Markdown-It、KaTeX、PDF.jsです。
