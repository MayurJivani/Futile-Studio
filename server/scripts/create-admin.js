import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const [, , username, password] = process.argv;

if (!username || !password) {
	console.error('Usage: npm run create-admin -- <username> <password>');
	process.exit(1);
}
if (password.length < 8) {
	console.error('Password must be at least 8 characters.');
	process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
	db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username);
	console.log(`Password updated for "${username}".`);
} else {
	db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
	console.log(`Admin user "${username}" created.`);
}
