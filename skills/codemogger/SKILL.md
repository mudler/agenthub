# Agentic Skill: Code Indexing with codemogger

## Overview

codemogger is a code indexing library for AI coding agents. It parses source code with tree-sitter, chunks it into semantic units (functions, structs, classes, impl blocks), embeds them locally, and stores everything in a single SQLite file with vector + full-text search.

**Key Characteristics:**
- No Docker, no server, no API keys
- One `.db` file per codebase
- Runs entirely locally
- Supports 13+ languages: Rust, C, C++, Go, Python, Zig, Java, Scala, JavaScript, TypeScript, TSX, PHP, Ruby

---

## Core Philosophy for Autonomous Execution

When using codemogger for code understanding and search, adhere to these principles:

1. **Always Index Before Searching**: A codebase must be indexed before semantic or keyword search can work
2. **Incremental Updates**: Use `reindex` to update the index after code changes - only changed files are re-processed
3. **Choose the Right Search Mode**: 
   - **Semantic**: When you don't know exact keywords (natural language queries)
   - **Keyword**: When you know exact identifiers or function names
4. **Local Embeddings**: The default embedding model (`all-MiniLM-L6-v2`) runs locally on CPU - no API keys required
5. **Single DB Per Codebase**: Each project gets its own `.db` file stored alongside the code

---

## Installation

codemogger is distributed as a Bun/Node.js package. Install globally or use with npx:

```bash
# Global install
npm install -g codemogger

# Or use npx without installing
npx -y codemogger <command>
```

---

## CLI Operations

### 1. Index a Codebase

Index a project for the first time:

```bash
codemogger index ./my-project
```

This creates `./my-project.db` containing the indexed code.

### 2. Search

**Semantic Search** (natural language - when you don't know exact names):
```bash
codemogger search "authentication middleware"
```

**Keyword Search** (precise identifier lookup):
```bash
codemogger search "BTreeCursor" --mode keyword
```

### 3. Reindex

Update the index after code changes (only re-processes changed files):
```bash
codemogger reindex ./my-project
```

### 4. List Indexed Codebases

```bash
codemogger list
```

---

## MCP Server Integration

codemogger can run as an MCP server, exposing three tools to your coding agent:

### Configuration (Claude Code, OpenCode, etc.)

```json
{
  "mcpServers": {
    "codemogger": {
      "command": "npx",
      "args": ["-y", "codemogger", "mcp"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `codemogger_index` | Index a codebase for the first time |
| `codemogger_reindex` | Update the index after modifying files |
| `codemogger_search` | Semantic and keyword search over indexed code |

---

## SDK Usage for Autonomous Agents

For programmatic access from agent code:

```typescript
import { CodeIndex } from "codemogger"
import { pipeline } from "@huggingface/transformers"

// Load embedding model (runs locally, no API keys)
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" })

const embedder = async (texts: string[]): Promise<number[][]> => {
  const output = await extractor(texts, { pooling: "mean", normalize: true })
  return output.tolist() as number[][]
}

const db = new CodeIndex({
  dbPath: "./my-project.db",
  embedder,
  embeddingModel: "all-MiniLM-L6-v2",
})

// Index the project
await db.index("/path/to/project")

// Semantic search - "what does this codebase do?"
const semanticResults = await db.search("authentication middleware", { mode: "semantic" })

// Keyword search - precise identifier lookup
const keywordResults = await db.search("BTreeCursor", { mode: "keyword" })

await db.close()
```

---

## Search Quality Examples

### Semantic Search vs ripgrep

**Query**: "write-ahead log replication and synchronization" (on Turso codebase)

| codemogger (top results) | ripgrep |
|---|---|
| `impl LogicalLog` - core/mvcc/persistent_storage/logical_log.rs | 3 files matched |
| `enum CommitState` - core/mvcc/database/mod.rs | (keyword: "write-ahead") |
| `function new` - core/mvcc/database/checkpoint_state_machine.rs | |

**Query**: "HTTP request parsing and response writing" (on Bun)

| codemogger (top results) | ripgrep |
|---|---|
| `function consumeRequestLine` - packages/bun-uws/src/HttpParser.h | 0 files matched |
| `declaration ConsumeRequestLineResult` - packages/bun-uws/src/HttpParser.h | (keyword: "HTTP") |

---

## Performance Notes

- **Indexing**: One-time cost dominated by embedding (~97% of time). Incremental runs only re-embed changed files.
- **Search**: Semantic search is 25x-370x faster than ripgrep and returns precise definitions instead of thousands of file matches.
- **Storage**: Single `.db` file per codebase with embedded SQLite (via Turso).

---

## Agent Workflow Integration

1. **First Contact with Codebase**: Run `codemogger index <path>` to build the initial index
2. **Understanding Unknown Code**: Use semantic search to find relevant code without knowing exact names
3. **Finding Definitions**: Use keyword search to locate specific functions, structs, or classes
4. **After Code Changes**: Run `codemogger reindex <path>` to update the index incrementally
5. **Multiple Codebases**: Each codebase maintains its own `.db` file - track them separately

---

## Environment Notes

- **Runtime**: Bun is preferred (see `bun` skill), but Node.js also works
- **Dependencies**: `@huggingface/transformers` for local embeddings
- **Storage**: SQLite file stored alongside the indexed project
