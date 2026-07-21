# CHATGPT_CONTEXT.md

# Milestone Tracker --- ChatGPT Development Context

> This document summarizes the project's evolution, architecture, design
> decisions, and coding rules for AI assistants. Read this before making
> architectural changes.

------------------------------------------------------------------------

# Project

**Milestone Tracker** is a personal AI-powered health tracker.

Long-term vision:

> Build an AI Health Operating System with **Pixel Secretary** as the
> primary assistant.

------------------------------------------------------------------------

# Current Release

-   Version: **v1.8.0**
-   Status: **Stable**
-   Branch: **Merged into main**
-   Release: **Nutrition Architecture** — shared classifyFood() abstraction, deterministic enrichment, and heuristic protein estimation

------------------------------------------------------------------------

# Philosophy

-   Prefer architecture over quick fixes.
-   Keep systems modular.
-   Extend instead of rewrite.
-   Prefer deterministic logic where possible.
-   Separate responsibilities clearly.

------------------------------------------------------------------------

# AI Coding Agent Rules

The AI assistant acts as a Senior Software Engineer, not merely a code
generator.

## Primary Goal

Prioritize:

1.  Stability
2.  Maintainability
3.  Architecture
4.  Minimal Git Diff
5.  Readability

Never sacrifice long-term maintainability for short-term convenience.

------------------------------------------------------------------------

# Development Workflow

Before making ANY code changes:

1.  Analyze the current implementation.
2.  Explain how the existing implementation works.
3.  Identify the root cause.
4.  List possible solutions.
5.  Recommend the safest solution.
6.  Explain the expected Git diff size.
7.  Only then begin implementation.

------------------------------------------------------------------------

# Implementation Rules

Always:

-   Preserve the existing architecture.
-   Extend instead of rewrite.
-   Keep Git diffs as small as possible.
-   Preserve naming conventions.
-   Preserve coding style.
-   Preserve backward compatibility.
-   Modify only files directly related to the requested task.
-   Avoid unnecessary abstractions.
-   Avoid speculative optimizations.
-   Avoid changing unrelated logic.
-   Keep commits focused on a single purpose.

Never:

-   Rewrite working systems without approval.
-   Rename files without approval.
-   Move files without approval.
-   Introduce new dependencies without approval.
-   Perform large-scale refactoring automatically.
-   Change project architecture unless explicitly requested.

------------------------------------------------------------------------

# CSS Rules

Prefer:

-   Reusing existing classes.
-   Flexbox/Grid over fixed positioning.
-   Responsive layouts.
-   Mobile fixes isolated inside media queries.
-   CSS variables where appropriate.

Avoid:

-   Duplicate CSS.
-   Unused selectors.
-   Inline styles.
-   !important unless absolutely necessary.
-   Large responsive rewrites.

Desktop behavior must remain unchanged unless explicitly requested.

------------------------------------------------------------------------

# JavaScript Rules

-   Do not rewrite working functions.
-   Keep function signatures stable.
-   Preserve public APIs.
-   Keep business logic deterministic.
-   Prefer localized changes.
-   Do not introduce unnecessary helper functions.

------------------------------------------------------------------------

# HTML Rules

-   Preserve semantic HTML.
-   Avoid unnecessary wrapper elements.
-   Replace inline styles with reusable CSS classes when appropriate.

------------------------------------------------------------------------

# Self Review

After implementation, always perform a code review.

Verify:

-   No desktop regression.
-   No mobile regression.
-   No broken layouts.
-   No duplicate CSS.
-   No dead code.
-   No accessibility regressions.
-   No unnecessary complexity.
-   No unrelated file changes.

------------------------------------------------------------------------

# Response Format

Always provide:

## Analysis

-   Current implementation
-   Root cause
-   Recommended solution

## Implementation

-   Files changed
-   Summary of changes

## Review

-   Risk Level (Low / Medium / High)
-   Confidence (0--100%)
-   Potential side effects
-   Remaining limitations

If a simpler solution exists, describe it separately instead of
implementing it automatically.

------------------------------------------------------------------------

# Project Philosophy

Prefer:

-   Small commits.
-   Small pull requests.
-   Small Git diffs.
-   Stable architecture.
-   Evolution over replacement.

If a feature can be implemented by extending the current architecture,
always prefer extension over replacement.
