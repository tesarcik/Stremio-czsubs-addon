# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-06-04

### Added
- Added Superfulltext search support (`fsf=1` parameter) to find subtitles that are not in the primary database search index (e.g., *The Other Bennet Sister*).

### Changed
- Improved title matching algorithm in `server.js` by ignoring common English stopwords (like "the", "a", "an", "and", etc.) to prevent matching incorrect subtitles.

### Fixed
- Fixed bug in `test.js` script where `searchForSubtitles` was called with missing arguments.
- Fixed outdated HTML selectors in `test.js` to match current `premium.titulky.com` layout.
- Installed missing dependencies (like `unzipper`) required for the addon.

## [1.0.0] - 2026-05-30

### Added
- Initial release of the Premium Titulky.com Stremio Addon.
- Configurable settings page for username and password.
- Automatic subtitle scraping, ZIP download, decompression, and streaming to Stremio.
- Czech and Slovak subtitle language support.
