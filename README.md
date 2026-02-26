# codemogger Skill

This skill provides guidance for autonomous agents on using codemogger for code indexing and semantic search.

codemogger is a code indexing library that parses source code with tree-sitter, chunks it into semantic units, embeds them locally, and stores everything in a single SQLite file with vector + full-text search.

## Skill Structure

- `skills/codemogger/SKILL.md` - Main skill definition following the Agent Skills specification

## Usage

This skill enables agents to:
1. Index codebases for semantic and keyword search
2. Search indexed codebases using natural language or precise identifiers
3. Integrate codemogger as an MCP server
4. Use the SDK for programmatic access
