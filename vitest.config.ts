import {defineConfig} from 'vitest/config';
export default defineConfig({esbuild:{jsx:'automatic'},test:{environment:'jsdom',setupFiles:['./tests/setup.ts'],exclude:['e2e/**','node_modules/**']},resolve:{alias:{'@':process.cwd()}}});
