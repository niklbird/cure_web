/* tslint:disable */
/* eslint-disable */
export class RrdpEntry {
  free(): void;
  constructor(uri: string, content: string);
  readonly uri: string;
  readonly content: string;
}
export class State {
  free(): void;
  constructor(data: string);
  drag_node(id: number, new_parent: number, child_index: number): void;
  repositorify(): Uint8Array;
  static load_example(typ: string): State;
  get_nodes(): string;
  add_node(typ: number, value: string, parent: number, label: string, child_position?: number | null): void;
  adapt_node_content(id: number, new_content: string): void;
  adapt_node_all(id: number, new_tag: number, new_length: number | null | undefined, new_content: string): void;
  adapt_node_length(id: number, new_length: number): void;
  adapt_node_tag(id: number, tag: number): void;
  adapt_node_label(id: number, new_label: string): void;
  remove_node(id: number): void;
  export_bin(): Uint8Array;
  export_base64(): string;
  encode_store(): string;
  static from_stored(encoded: string): State;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_rrdpentry_free: (a: number, b: number) => void;
  readonly rrdpentry_new: (a: number, b: number, c: number, d: number) => number;
  readonly rrdpentry_uri: (a: number) => [number, number];
  readonly rrdpentry_content: (a: number) => [number, number];
  readonly __wbg_state_free: (a: number, b: number) => void;
  readonly state_new: (a: number, b: number) => [number, number, number];
  readonly state_drag_node: (a: number, b: number, c: number, d: number) => [number, number];
  readonly state_repositorify: (a: number) => [number, number];
  readonly state_load_example: (a: number, b: number) => [number, number, number];
  readonly state_get_nodes: (a: number) => [number, number];
  readonly state_add_node: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
  readonly state_adapt_node_content: (a: number, b: number, c: number, d: number) => [number, number];
  readonly state_adapt_node_all: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly state_adapt_node_length: (a: number, b: number, c: number) => [number, number];
  readonly state_adapt_node_tag: (a: number, b: number, c: number) => [number, number];
  readonly state_adapt_node_label: (a: number, b: number, c: number, d: number) => [number, number];
  readonly state_remove_node: (a: number, b: number) => [number, number];
  readonly state_export_bin: (a: number) => [number, number];
  readonly state_export_base64: (a: number) => [number, number];
  readonly state_encode_store: (a: number) => [number, number];
  readonly state_from_stored: (a: number, b: number) => [number, number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
