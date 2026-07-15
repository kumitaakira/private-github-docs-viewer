<div align="center">

# RepoShelf

### Your private repository, made readable.

**プライベートリポジトリのMarkdownとPDFを、ひとつの静かな読書体験に。**

[![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-8b5cf6)](LICENSE)

</div>

<br />

<table>
<tr><td width="50%" valign="top">

## Read what you already own

RepoShelf is a lightweight, browser-based shelf for documents living in private GitHub repositories. Connect once, then browse Markdown and PDF files without leaving your reading flow.

</td><td width="50%" valign="top">

## すぐ読める、あなたの文書棚

RepoShelfは、プライベートなGitHubリポジトリにある文書を読むためのブラウザアプリです。接続先を登録すれば、MarkdownとPDFを同じ画面で閲覧できます。

</td></tr>
</table>

## Highlights

<table>
<tr><td>📚</td><td><strong>Repository shelf</strong><br />複数のリポジトリを登録し、いつもの場所から開けます。</td></tr>
<tr><td>🔎</td><td><strong>Search that stays close</strong><br />ファイル名・パス・Markdown本文・現在のファイルを検索できます。</td></tr>
<tr><td>📝</td><td><strong>Markdown, beautifully rendered</strong><br />コードハイライト、数式、タスクリストに対応。</td></tr>
<tr><td>📄</td><td><strong>PDF in the same shelf</strong><br />PDFを連続ページで表示し、ズームできます。</td></tr>
<tr><td>🌗</td><td><strong>Your preferred atmosphere</strong><br />ライト／ダークテーマと日本語／英語UIを切り替えられます。</td></tr>
</table>

## Getting started

```bash
npm install
npm run dev
```

1. **Add a repository** — `owner/repo` と Personal Access Token を入力します。
2. **Choose a file** — MarkdownまたはPDFを選びます。
3. **Keep reading** — 最後に開いたファイルは次回もすぐ開けます。

> Tokenはブラウザのローカルストレージに保存されます。共有端末では使用後に接続先を削除してください。

## Development

```bash
npm run typecheck
npm run test:run
npm run build
```

RepoShelf is built with React, TypeScript, Vite, TanStack Query, Markdown-It, KaTeX, and PDF.js.

<div align="center">

### Keep your docs private. Make them easy to read.

</div>
