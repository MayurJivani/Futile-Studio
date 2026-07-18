import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default tseslint.config(
	{ ignores: ['dist/', '.astro/', 'node_modules/', 'server/', 'public/'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	...astro.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser },
		},
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
		},
	}
);
