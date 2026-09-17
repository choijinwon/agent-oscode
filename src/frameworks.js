const guidance = {
  react: 'Use existing hooks, state ownership and JSX conventions. Preserve server/client boundaries. Prefer installed React UI libraries and existing test scripts.',
  vue: 'Use Vue SFCs and existing Composition/Options API conventions. Keep props readonly and communicate through emits/slots. Prefer installed Vue libraries; validate with vue-tsc and existing scripts.',
  angular: 'Use Angular templates, dependency injection and existing standalone/NgModule conventions. Keep inputs/outputs explicit. Prefer Angular libraries; inspect angular.json and existing test scripts.',
  svelte: 'Use Svelte components and the declared major version: Svelte 5 runes differ from legacy syntax. Preserve SvelteKit server/client boundaries and existing svelte-check/test scripts.'
};
export function detectFrameworks(deps = {}) {
  return Object.entries({ react: 'react', vue: 'vue', angular: '@angular/core', svelte: 'svelte' }).filter(([, pkg]) => Object.hasOwn(deps, pkg)).map(([id, pkg]) => ({ id, package: pkg, version: deps[pkg], guidance: guidance[id] }));
}
const native = {
  react: { package: 'react', extension: '.jsx', minimum: 17, setup: guidance.react },
  vue: { package: 'vue', extension: '.vue', minimum: 3, minimumMinor: 2, setup: guidance.vue },
  angular: { package: '@angular/core', extension: '.ts', minimum: 14, setup: guidance.angular },
  svelte: { package: 'svelte', extension: '.svelte', minimum: 5, setup: guidance.svelte }
};
const templates = {
  react: {
    button: `export default function ActionButton({ disabled = false, onClick, children = 'Save' }) { return <button type="button" disabled={disabled} onClick={onClick}>{children}</button>; }`,
    card: `export default function InfoCard({ title = 'Project', children }) { return <article><h2>{title}</h2>{children}</article>; }`,
    alert: `export default function StatusAlert({ children = 'Check your changes.' }) { return <p role="status">{children}</p>; }`,
    pagination: `export default function PageNavigation({ page = 1, count = 1, onChange }) { return <nav aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onChange?.(page - 1)}>Previous</button><span aria-live="polite">{page} / {count}</span><button type="button" disabled={page >= count} onClick={() => onChange?.(page + 1)}>Next</button></nav>; }`,
    dropdown: `export default function ActionDisclosure({ onEdit }) { return <details><summary>Actions</summary><button type="button" onClick={onEdit}>Edit</button></details>; }`
  },
  vue: {
    button: `<script setup>\ndefineProps({ disabled: Boolean });\nconst emit = defineEmits(['activate']);\n</script>\n<template><button type="button" :disabled="disabled" @click="emit('activate')"><slot>Save</slot></button></template>`,
    card: `<script setup>\ndefineProps({ title: { type: String, default: 'Project' } });\n</script>\n<template><article><h2>{{ title }}</h2><slot /></article></template>`,
    alert: `<template><p role="status"><slot>Check your changes.</slot></p></template>`,
    pagination: `<script setup>\ndefineProps({ page: { type: Number, default: 1 }, count: { type: Number, default: 1 } });\nconst emit = defineEmits(['change']);\n</script>\n<template><nav aria-label="Pagination"><button type="button" :disabled="page <= 1" @click="emit('change', page - 1)">Previous</button><span aria-live="polite">{{ page }} / {{ count }}</span><button type="button" :disabled="page >= count" @click="emit('change', page + 1)">Next</button></nav></template>`,
    dropdown: `<script setup>\nconst emit = defineEmits(['edit']);\n</script>\n<template><details><summary>Actions</summary><button type="button" @click="emit('edit')">Edit</button></details></template>`
  },
  svelte: {
    button: `<script>\nlet { disabled = false, onactivate = () => {}, label = 'Save' } = $props();\n</script>\n<button type="button" {disabled} onclick={onactivate}>{label}</button>`,
    card: `<script>\nlet { title = 'Project', children } = $props();\n</script>\n<article><h2>{title}</h2>{#if children}{@render children()}{/if}</article>`,
    alert: `<script>\nlet { message = 'Check your changes.' } = $props();\n</script>\n<p role="status">{message}</p>`,
    pagination: `<script>\nlet { page = 1, count = 1, onchange = () => {} } = $props();\n</script>\n<nav aria-label="Pagination"><button type="button" disabled={page <= 1} onclick={() => onchange(page - 1)}>Previous</button><span aria-live="polite">{page} / {count}</span><button type="button" disabled={page >= count} onclick={() => onchange(page + 1)}>Next</button></nav>`,
    dropdown: `<script>\nlet { onedit = () => {} } = $props();\n</script>\n<details><summary>Actions</summary><button type="button" onclick={onedit}>Edit</button></details>`
  }
};
const angular = {
  button: { name: 'ActionButton', inputs: `@Input() label = 'Save'; @Input() disabled = false; @Output() activate = new EventEmitter<void>();`, template: `<button type="button" [disabled]="disabled" (click)="activate.emit()">{{ label }}</button>` },
  card: { name: 'InfoCard', inputs: `@Input() title = 'Project';`, template: `<article><h2>{{ title }}</h2><ng-content></ng-content></article>` },
  alert: { name: 'StatusAlert', inputs: `@Input() message = 'Check your changes.';`, template: `<p role="status">{{ message }}</p>` },
  pagination: { name: 'PageNavigation', inputs: `@Input() page = 1; @Input() count = 1; @Output() pageChange = new EventEmitter<number>();`, template: `<nav aria-label="Pagination"><button type="button" [disabled]="page <= 1" (click)="pageChange.emit(page - 1)">Previous</button><span aria-live="polite">{{ page }} / {{ count }}</span><button type="button" [disabled]="page >= count" (click)="pageChange.emit(page + 1)">Next</button></nav>` },
  dropdown: { name: 'ActionDisclosure', inputs: `@Output() edit = new EventEmitter<void>();`, template: `<details><summary>Actions</summary><button type="button" (click)="edit.emit()">Edit</button></details>` }
};
templates.angular = Object.fromEntries(Object.entries(angular).map(([key, value]) => [key, `import { Component${value.inputs.includes('@Input') ? ', Input' : ''}${value.inputs.includes('@Output') ? ', Output, EventEmitter' : ''} } from '@angular/core';\n@Component({ selector: 'oscode-${key}', standalone: true, template: ${JSON.stringify(value.template)} })\nexport class ${value.name}Component { ${value.inputs} }`]));
export function nativeRecipe(framework, component) {
  if (!Object.hasOwn(native, framework)) return null;
  const info = native[framework];
  if (component && !Object.hasOwn(templates[framework], component)) throw new Error('Choose button, card, alert, pagination or dropdown.');
  return { library: framework, framework, ...info, packages: [info.package], components: Object.keys(templates[framework]), ...(component ? { component, code: templates[framework][component] + '\n' } : {}), source: 'oscode-authored native starter (MIT).', integration: 'Unstyled starter. Reuse project design tokens; wire inputs/events and import into the target screen. Pagination is controlled by its parent; validate page/count. Dropdown is a native disclosure, not an ARIA menu. Confirm compiler and framework version before applying.' };
}
