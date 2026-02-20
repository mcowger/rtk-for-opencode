# RTK for OpenCode

An OpenCode plugin implementing token reduction techniques from the Rust Token Killer (RTK) project.

> Reduce LLM token consumption by 60-90% while preserving essential information

## Features

This plugin intercepts tool results in OpenCode and applies intelligent filtering:

- **Phase 1**: ANSI escape stripping, hard truncation
- **Phase 2**: Build/test/linter output aggregation
- **Phase 3**: Source code filtering (comments removal, aggressive mode)
- **Phase 4**: Git output compaction, search result grouping

All techniques are configurable and can be enabled/disabled individually.

## Installation

```bash
# Via npm
npm install rtk-for-opencode

# Via bun
bun install rtk-for-opencode
```

## Usage

Add to your `opencode.json`:

```json
{
  "plugin": ["rtk-for-opencode"]
}
```

Or create a local plugin file in `.opencode/plugins/rtk.ts`:

```typescript
export { RtkPlugin as default } from 'rtk-for-opencode';
```

## Configuration

Create `.opencode/rtk-config.json`:

```json
{
  "enabled": true,
  "logSavings": true,
  "techniques": {
    "ansiStripping": true,
    "truncation": { "enabled": true, "maxChars": 10000 },
    "sourceCodeFiltering": "minimal",
    "smartTruncation": { "enabled": true, "maxLines": 200 },
    "testOutputAggregation": true,
    "buildOutputFiltering": true,
    "gitCompaction": true,
    "searchResultGrouping": true,
    "linterAggregation": true
  }
}
```

### Configuration Options

| Option                                | Type                                  | Description                                                   |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `enabled`                             | boolean                               | Master switch to enable/disable the plugin                    |
| `logSavings`                          | boolean                               | Log token savings to OpenCode and `.memory/rtk-metrics.jsonl` |
| `techniques.ansiStripping`            | boolean                               | Remove color codes and formatting from terminal output        |
| `techniques.truncation.enabled`       | boolean                               | Hard truncate long outputs                                    |
| `techniques.truncation.maxChars`      | number                                | Maximum characters before truncation                          |
| `techniques.sourceCodeFiltering`      | `"none" \| "minimal" \| "aggressive"` | Level of source code filtering                                |
| `techniques.smartTruncation.enabled`  | boolean                               | Intelligent truncation preserving structure                   |
| `techniques.smartTruncation.maxLines` | number                                | Maximum lines before smart truncation                         |
| `techniques.testOutputAggregation`    | boolean                               | Compact test output (keep failures only)                      |
| `techniques.buildOutputFiltering`     | boolean                               | Remove compilation noise, keep errors                         |
| `techniques.gitCompaction`            | boolean                               | Compact git diff/status/log output                            |
| `techniques.searchResultGrouping`     | boolean                               | Group grep results by file                                    |
| `techniques.linterAggregation`        | boolean                               | Aggregate linter output by rule/file                          |

## Technique Details

### Phase 1: Universal Filters

#### ANSI Escape Stripping (`ansiStripping`)

**What it does:** Removes terminal color codes and formatting sequences (e.g., `\x1b[31m` for red text) from all tool outputs.

**Risk:** None - purely cosmetic removal, zero information loss.

**Potential savings:** 5-15% on terminal output with heavy coloring (test frameworks, build tools).

**Recommendation:** ✅ Always enable - no downside.

#### Text Truncation (`truncation`)

**What it does:** Hard truncates any output exceeding `maxChars` (default 10,000), appending a truncation notice.

**Risk:** High - data is permanently lost. The LLM won't see truncated content.

**Potential savings:** Variable - caps output at configured limit.

**Recommendation:** ⚠️ Use as safety net only. Set `maxChars` high enough (10000+) to only catch runaway outputs.

---

### Phase 2: Command-Specific Filters (bash tool)

#### Build Output Filtering (`buildOutputFiltering`)

**What it does:** Removes "Compiling...", "Downloading...", "Checking..." progress messages from build commands (cargo, npm, etc.). Keeps only errors and warnings.

**Risk:** Low - you might miss which specific crate/package was being compiled during a failure.

**Potential savings:** 70-90% on successful builds; 20-40% on failed builds (errors preserved).

**Recommendation:** ✅ Enable for routine builds; disable when debugging complex build issues.

#### Test Output Aggregation (`testOutputAggregation`)

**What it does:** When all tests pass: shows only summary (`✅ 42 passed`). When tests fail: keeps failure details + summary.

**Risk:** Medium - you lose test stdout/stderr from passing tests. Might miss warnings or deprecation notices.

**Potential savings:** 60-80% when all tests pass; 30-50% with failures (failure details preserved).

**Recommendation:** ✅ Enable for CI-like workflows; disable when actively debugging tests.

#### Linter Output Aggregation (`linterAggregation`)

**What it does:** Groups lint errors by rule and file, showing top 10 rules and files with issue counts.

**Risk:** Low - you lose exact line numbers and message details, but can still see which files/rules have issues.

**Potential savings:** 50-70% on projects with many lint warnings.

**Recommendation:** ✅ Enable for overview; run linter directly when you need exact line numbers.

#### Git Compaction (`gitCompaction`)

**What it does:**

- `git diff`: Shows file headers + stats (+N/-M), truncates hunks to 10 lines
- `git status`: Groups into staged/modified/untracked with counts
- `git log`: Truncates long lines, limits to 20 commits

**Risk:** Medium - you lose full diff context and exact line-by-line changes. Status loses detailed mode changes.

**Potential savings:** 40-60% on large diffs; 30-50% on status.

**Recommendation:** ✅ Enable for quick reviews; disable when doing careful code review or complex merges.

#### Search Result Grouping (`searchResultGrouping`)

**What it does:** Groups `grep`/`rg` results by file, showing up to 10 matches per file.

**Risk:** Low - you might miss matches beyond the first 10 per file, but total match count is shown.

**Potential savings:** 30-50% on searches with many matches in same file.

**Recommendation:** ✅ Enable for most searches; disable when you need to see every occurrence.

---

### Phase 3: Source Code Filters (read tool)

#### Source Code Filtering (`sourceCodeFiltering`)

**What it does:**

- `minimal`: Removes comments (//, /\* \*/, #) while preserving docstrings
- `aggressive`: Keeps only imports/exports, function signatures, and constants; replaces function bodies with `// ...`

**Risk:**

- `minimal`: Low - comments rarely contain actionable information for the LLM
- `aggressive`: High - the LLM can't see implementation details, only API surface

**Potential savings:**

- `minimal`: 10-30% depending on comment density
- `aggressive`: 60-80% on large implementation files

**Recommendation:**

- `minimal`: ✅ Safe default - removes noise
- `aggressive`: ⚠️ Only enable when LLM just needs to understand API, not implementation

#### Smart Truncation (`smartTruncation`)

**What it does:** Truncates large source files to `maxLines`, preferentially keeping imports, signatures, and structure markers.

**Risk:** Medium - you lose middle sections of files, but the LLM sees beginning and important structural elements.

**Potential savings:** Variable - caps source files at configured line limit.

**Recommendation:** ✅ Enable with `maxLines: 200-300`. Large files are usually boilerplate or data; the LLM rarely needs full content.

## A/B Testing

To determine which techniques are most valuable:

1. Start with all enabled
2. Disable one technique at a time in `rtk-config.json`
3. Check `.memory/rtk-metrics.jsonl` for savings per technique
4. Session summaries appear in OpenCode logs on `session.idle`

Example metrics file:

```jsonl
{"timestamp":"2024-01-15T10:30:00.000Z","sessionId":"abc123","tool":"bash","technique":"ansi-stripping","originalChars":5000,"filteredChars":4500,"savingsPercent":10}
{"timestamp":"2024-01-15T10:30:05.000Z","sessionId":"abc123","tool":"bash","technique":"build-filter","originalChars":10000,"filteredChars":2000,"savingsPercent":80}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Build
mise run build

# Lint
mise run lint

# Type check
mise run typecheck
```

### Local Development

Use the dev shim in `.opencode/plugins/rtk-dev.ts`:

```typescript
export { RtkPlugin as default } from '../../src/plugin.ts';
```

This loads the TypeScript source directly without needing to build.

## Techniques Implemented

Based on [RTK Token Reduction Techniques](docs/RTK.md):

| #   | Technique                   | Phase         | Risk   | Typical Savings |
| --- | --------------------------- | ------------- | ------ | --------------- |
| 1   | **ANSI Escape Stripping**   | 1 - Universal | None   | 5-15%           |
| 2   | **Text Truncation**         | 1 - Universal | High   | Capped at limit |
| 3   | **Build Output Filtering**  | 2 - bash      | Low    | 70-90%          |
| 4   | **Test Output Aggregation** | 2 - bash      | Medium | 60-80%          |
| 5   | **Linter Aggregation**      | 2 - bash      | Low    | 50-70%          |
| 6   | **Git Compaction**          | 2 - bash      | Medium | 40-60%          |
| 7   | **Search Grouping**         | 2 - bash      | Low    | 30-50%          |
| 8   | **Source Code Filtering**   | 3 - read      | Varies | 10-80%          |
| 9   | **Smart Truncation**        | 3 - read      | Medium | Variable        |

**Risk Levels:**

- **None** - No information loss, purely cosmetic
- **Low** - Minor details lost, unlikely to affect LLM understanding
- **Medium** - Some context lost, may need to disable for debugging
- **High** - Significant data loss, use only as safety net

## Recommended Configurations

### Conservative (Safest)

```json
{
  "techniques": {
    "ansiStripping": true,
    "truncation": { "enabled": true, "maxChars": 15000 },
    "sourceCodeFiltering": "minimal",
    "smartTruncation": { "enabled": true, "maxLines": 300 },
    "testOutputAggregation": false,
    "buildOutputFiltering": true,
    "gitCompaction": false,
    "searchResultGrouping": false,
    "linterAggregation": true
  }
}
```

### Balanced (Default)

```json
{
  "techniques": {
    "ansiStripping": true,
    "truncation": { "enabled": true, "maxChars": 10000 },
    "sourceCodeFiltering": "minimal",
    "smartTruncation": { "enabled": true, "maxLines": 200 },
    "testOutputAggregation": true,
    "buildOutputFiltering": true,
    "gitCompaction": true,
    "searchResultGrouping": true,
    "linterAggregation": true
  }
}
```

### Aggressive (Maximum savings)

```json
{
  "techniques": {
    "ansiStripping": true,
    "truncation": { "enabled": true, "maxChars": 8000 },
    "sourceCodeFiltering": "aggressive",
    "smartTruncation": { "enabled": true, "maxLines": 150 },
    "testOutputAggregation": true,
    "buildOutputFiltering": true,
    "gitCompaction": true,
    "searchResultGrouping": true,
    "linterAggregation": true
  }
}
```

⚠️ **Warning:** Aggressive mode may cause the LLM to miss important implementation details.

## Architecture

```
src/
├── config.ts          # Configuration types and loader
├── metrics.ts         # Token counting, savings tracking
├── plugin.ts          # Main OpenCode plugin
├── techniques/        # Individual filtering techniques
│   ├── ansi.ts        # ANSI escape stripping
│   ├── build.ts       # Build output filtering
│   ├── git.ts         # Git output compaction
│   ├── linter.ts      # Linter output aggregation
│   ├── search.ts      # Search result grouping
│   ├── source.ts      # Source code filtering
│   ├── test-output.ts # Test output aggregation
│   └── truncate.ts    # Text truncation
└── index.ts           # Public API exports
```

## License

MIT - See [LICENSE](LICENSE) file for details.

> A Bun module created from the [bun-module](https://github.com/zenobi-us/bun-module) template
