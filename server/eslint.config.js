import js from '@eslint/js';
import globals from 'globals';

export default [
	{ ignores: ['node_modules/', 'data/', 'uploads/'] },
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: { ...globals.node },
		},
		rules: {
			eqeqeq: ['error', 'smart'],
			'no-var': 'error',
			'prefer-const': 'error',
			'no-unused-vars': ['error', { argsIgnorePattern: '^next$|^req$|^res$' }],
		},
	},
];
