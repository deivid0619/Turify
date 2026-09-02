// Config aparte, solo para `no-undef`. La config principal del proyecto no lo
// activa, y ese es justo el error que rompe la pantalla en tiempo de ejecución
// sin que el build diga nada: un identificador que se usa pero ya no se declara.
import globals from 'globals';

export default [
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021, process: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'no-undef': 'error' },
  },
];
