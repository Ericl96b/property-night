// Rules presets (SPEC §8): the built-in read-only "Classic" preset plus user presets; save,
// rename, duplicate, delete, export/import JSON. Board presets join in M8.
import { CLASSIC_RULES, type Rules } from '../engine';
import type { KV } from '../storage/db';
import { RULE_FIELDS, coerce } from './rulesSchema';

export interface RulesPreset {
  id: string;
  kind: 'rules';
  name: string;
  builtIn?: boolean;
  rules: Rules;
  updatedAt: number;
}

export const CLASSIC_PRESET: RulesPreset = { id: 'classic', kind: 'rules', name: 'Classic', builtIn: true, rules: { ...CLASSIC_RULES }, updatedAt: 0 };

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Fill missing/invalid settings from Classic and clamp every value. */
export function normalizeRules(raw: Partial<Rules> | undefined): Rules {
  const out: Record<string, unknown> = { ...CLASSIC_RULES };
  for (const f of RULE_FIELDS) {
    const v = raw?.[f.key];
    if (v !== undefined) out[f.key] = coerce(f, v);
  }
  return out as unknown as Rules;
}

export class RulesPresets {
  constructor(private kv: KV) {}

  async list(): Promise<RulesPreset[]> {
    const all = (await this.kv.list<RulesPreset & { kind: string }>('presets')).filter((p) => p.kind === 'rules');
    all.sort((a, b) => a.name.localeCompare(b.name));
    return [CLASSIC_PRESET, ...all];
  }

  async get(id: string): Promise<RulesPreset> {
    if (id === CLASSIC_PRESET.id) return CLASSIC_PRESET;
    return (await this.kv.get<RulesPreset>('presets', id)) ?? CLASSIC_PRESET;
  }

  async save(p: RulesPreset): Promise<RulesPreset> {
    if (p.builtIn) throw new Error('Built-in presets are read-only — duplicate to edit.');
    const clean: RulesPreset = { ...p, kind: 'rules', rules: normalizeRules(p.rules), name: p.name.trim() || 'Untitled rules', updatedAt: Date.now() };
    await this.kv.put('presets', clean);
    return clean;
  }

  async duplicate(p: RulesPreset, name?: string): Promise<RulesPreset> {
    return this.save({ id: newId('rules'), kind: 'rules', name: name ?? `${p.name} copy`, rules: { ...p.rules }, updatedAt: Date.now() });
  }

  async rename(p: RulesPreset, name: string): Promise<RulesPreset> {
    return this.save({ ...p, name });
  }

  async remove(p: RulesPreset): Promise<void> {
    if (p.builtIn) throw new Error('Built-in presets cannot be deleted.');
    await this.kv.delete('presets', p.id);
  }

  exportJSON(p: RulesPreset): string {
    return JSON.stringify({ format: 'property-night/rules', version: 1, name: p.name, rules: p.rules }, null, 2);
  }

  async importJSON(text: string): Promise<RulesPreset> {
    let data: { format?: string; name?: string; rules?: Partial<Rules> };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    if (data.format !== 'property-night/rules' || typeof data.rules !== 'object') throw new Error('That file is not a Property Night rules preset.');
    return this.save({ id: newId('rules'), kind: 'rules', name: String(data.name ?? 'Imported rules'), rules: normalizeRules(data.rules), updatedAt: Date.now() });
  }
}

/** Offer a text file for download (export). */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
