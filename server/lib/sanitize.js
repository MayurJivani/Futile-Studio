import sanitizeHtml from 'sanitize-html';

/**
 * Post title/excerpt/body are stored as plain text / markdown source, never
 * as trusted HTML. `marked` (used on the client to render `body`) passes
 * raw HTML straight through, so anything that looks like a tag has to be
 * stripped here at write time — otherwise a stored `<script>` would run for
 * every visitor. Markdown syntax itself (`#`, `*`, `[]()`, ...) isn't HTML
 * and passes through untouched.
 */
export function stripHtml(value) {
	return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'discard' });
}
