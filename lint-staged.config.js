export default {
  '*.{ts,tsx,js,mjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{css,json,md,html,yml,yaml}': ['prettier --write'],
};
