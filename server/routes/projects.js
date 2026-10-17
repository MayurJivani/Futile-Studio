/* The board, editable.
 *
 * Reading is public: the static build asks for this at build time so the pages
 * are still rendered on the server with no client fetch. Everything that
 * writes sits behind the session and the CSRF token the login already issues.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { requireCsrf } from '../lib/security.js';
import {
	listProjects,
	getProject,
	createProject,
	updateProject,
	deleteProject,
	validateProject,
	seedIfEmpty,
} from '../lib/projects.js';

const router = Router();

seedIfEmpty();

router.get('/', (req, res) => {
	const all = listProjects();
	res.json({
		open: all.filter((p) => p.shelf === 'open'),
		workbench: all.filter((p) => p.shelf === 'workbench'),
	});
});

router.post('/', requireAuth, requireCsrf, (req, res) => {
	const v = validateProject(req.body, { requireId: true });
	if (!v.ok) return res.status(400).json({ error: v.error });
	const r = createProject(v.value);
	if (!r.ok) return res.status(409).json({ error: r.error });
	res.status(201).json(r.value);
});

router.put('/:id', requireAuth, requireCsrf, (req, res) => {
	/* The id in the path is the one that counts: a body that disagrees must not
	   be able to rewrite a different project than the one being addressed. */
	const v = validateProject({ ...req.body, id: req.params.id }, { requireId: true });
	if (!v.ok) return res.status(400).json({ error: v.error });
	const r = updateProject(req.params.id, v.value);
	if (!r.ok) return res.status(404).json({ error: r.error });
	res.json(r.value);
});

router.delete('/:id', requireAuth, requireCsrf, (req, res) => {
	if (!getProject(req.params.id)) return res.status(404).json({ error: 'no such project' });
	deleteProject(req.params.id);
	res.json({ ok: true });
});

export default router;
