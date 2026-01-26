# AI Context for awosd

## Repository
- **Path:** `/workspace/awosd`
- **Primary UI file:** `index.html` (contains HTML, CSS, and JS in one file)
- **Data files:** `airports.csv`, `runways.csv`
- **Docs:** `docs/git-push.md`

## Project Summary
Single-page web app that displays airport METAR/weather data, runway information, and compass indicators for a given ICAO code. It loads local CSV data (OurAirports) and fetches METAR data from external sources, then renders a multi-column UI with compasses and a bottom forecast section.

## Current Constraints & Notes
- UI layout and compass rendering have been heavily modified in prior iterations.
- There has been repeated confusion about branches/commits between local and remote histories; ensure you are working in the current repo state.
- The user frequently requests specific UI layout/compass behavior changes and expects strict adherence to instructions.

## Current Task (this chat)
- **Create this `AI_CONTEXT.md` file** with full project context and current task so it can be referenced in a new chat.

## Recent Issue Thread (high level)
- User requested removal of a METAR Copy button and questioned where it still appears.
- There were disputes about which commit/branch contained certain UI elements.
- User asked to align work to their `main` branch and specific commit hashes.
- Network access to GitHub may fail in this environment (observed 403 on fetch), so remote syncing might not be possible.

## Key Files to Check for UI Elements
- `index.html` — all UI, CSS, and JS live here.

## Tips for Future Sessions
- Verify actual file contents with `nl -ba index.html | sed -n '<range>p'` to avoid confusion.
- Use `rg -n "<term>" index.html` to locate UI elements or JS handlers.
- If user references a commit hash not present locally, ask for a patch or file content.
