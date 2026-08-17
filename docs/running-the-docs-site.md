# Running the Docs Site Locally

This page covers how to build and preview the [MkDocs](https://www.mkdocs.org/) site
(`docs/` → `site/`) that this file is part of — useful when editing anything under `docs/`,
`mkdocs.yml`, or `overrides/`.

## Prerequisites

You need Python 3.x and pip. This repo doesn't check in a `requirements.txt`/`environment.yml` for
docs — the exact pinned versions used in CI (and safe to reuse locally) live in
[`.github/workflows/docs-build-template.yml`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/.github/workflows/docs-build-template.yml):

```bash
pip install "mkdocs>=1.6,<2" "mkdocs-material>=9.7,<10" "mkdocs-include-markdown-plugin>=7,<8" "mkdocs-panzoom-plugin>=0.3,<1"
```

If you use `conda`/[`micromamba`](https://mamba.readthedocs.io/en/latest/user_guide/micromamba.html),
create a dedicated environment instead of installing into your base/system Python:

```bash
micromamba create -n cesium-docs python=3.12
micromamba activate cesium-docs
pip install "mkdocs>=1.6,<2" "mkdocs-material>=9.7,<10" "mkdocs-include-markdown-plugin>=7,<8" "mkdocs-panzoom-plugin>=0.3,<1"
```

Remember to `micromamba activate cesium-docs` (or your equivalent env) in every new terminal before
running any `mkdocs` command below — the base Python install does **not** have these plugins, and
`mkdocs serve`/`build` will fail with an error like `panzoom plugin is not installed`.

## Step 1 — Generate the CesiumJS skills table

One docs page is generated from source, not hand-written, and needs regenerating whenever
`packages/codegen-cesium`'s skills change:

```bash
npm run docs:generate:skills-table
```

## Step 2 — Serve locally with live reload

From the repo root, with the docs environment active:

```bash
mkdocs serve
```

This serves the site at `http://127.0.0.1:8000`, rebuilding on any save under `docs/`,
`mkdocs.yml`, or `overrides/`.

## Step 3 — Verify with a strict build before committing

`mkdocs serve` doesn't fail on broken links/nav entries — always run a strict build too:

```bash
mkdocs build --strict
```

This is the fastest way to catch a broken `include-markdown` reference, a bad relative link, or a
new page/package missing from `mkdocs.yml`'s `nav:` — the same check CI runs on every docs-related
PR (see [`.github/workflows/docs.yml`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/.github/workflows/docs.yml)).

## Gotchas

- **Duplicate `mkdocs serve` processes** are a common cause of "I fixed it but the browser still
  shows the old page" — stop any previously running instance before starting a new one.
- Windows is case-insensitive but git tracks file case exactly. A file whose on-disk case differs
  from what `mkdocs.yml`/a markdown link references builds fine locally but fails on case-sensitive
  CI — double check with `git ls-files <path>` if CI reports a page as "not found" that you can see
  locally.
- Cross-package README links (e.g. one package's `README.md` linking to another package's
  `README.md`) must use absolute `https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/...`
  URLs, not repo-relative markdown links — `docs/packages/*.md` pages `include-markdown` these
  READMEs verbatim, and a relative link gets rewritten to a path outside `docs/`, which
  `mkdocs build --strict` rejects as "target not found among documentation files".
