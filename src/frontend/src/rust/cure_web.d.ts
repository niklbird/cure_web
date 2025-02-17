/* tslint:disable */
/* eslint-disable */
export class State {
  free(): void;
  constructor(data: string);
  get_nodes(): string;
  add_node(typ: number, value: string, parent: number, label: string): void;
  adapt_node_content(id: number, new_content: string): void;
  adapt_node_length(id: number, new_length: number): void;
  adapt_node_tag(id: number, tag: number): void;
  remove_node(id: number): void;
  export_bin(): Uint8Array;
  export_base64(): string;
  encode_store(): string;
  static from_stored(encoded: string): State;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_state_free: (a: number, b: number) => void;
  readonly state_new: (a: number, b: number) => [number, number, number];
  readonly state_get_nodes: (a: number) => [number, number];
  readonly state_add_node: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly state_adapt_node_content: (a: number, b: number, c: number, d: number) => [number, number];
  readonly state_adapt_node_length: (a: number, b: number, c: number) => [number, number];
  readonly state_adapt_node_tag: (a: number, b: number, c: number) => [number, number];
  readonly state_remove_node: (a: number, b: number) => [number, number];
  readonly state_export_bin: (a: number) => [number, number];
  readonly state_export_base64: (a: number) => [number, number];
  readonly state_encode_store: (a: number) => [number, number];
  readonly state_from_stored: (a: number, b: number) => [number, number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
