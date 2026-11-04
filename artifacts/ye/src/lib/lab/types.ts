export type Lang = 'ar' | 'en';
export type Text = { ar: string; en: string };

export type PartRole = 'structure' | 'axle' | 'gear' | 'input' | 'output';

export interface PartDef {
  id: string;
  name: Text;
  description: Text;
  quantity: number;
  role: PartRole;
  /** Orientations the piece can be rotated through in the tray. First is default. */
  orientations: string[];
  /** Gear pitch radius (only for role 'gear'). */
  radius?: number;
  teeth?: number;
}

export interface AxisDef { id: string; x: number; y: number }

export interface SlotDef {
  id: string;
  /** Part that may sit here. */
  accepts: string;
  /** Orientations that fit. */
  orientations: string[];
  /** Other slots that must already be filled. */
  requires: string[];
  /** Axis this part spins on (moving parts only). */
  axis?: string;
  /** Marker position in workbench coordinates. */
  x: number;
  y: number;
  /** Text explaining what is missing when requirements fail. */
  requiresHint: Text;
}

export interface StepDef { id: string; slot: string; text: Text; hints: [Text, Text] }

export type ReasonCode = 'none-left' | 'slot-occupied' | 'wrong-part' | 'wrong-orientation' | 'missing-dependency' | 'unknown';
export type StatusCode = 'empty' | 'no-input' | 'input-no-gear' | 'missing-follower' | 'gears-not-meshed' | 'output-missing' | 'output-still' | 'success';

export interface Lesson {
  id: string;
  version: number;
  title: Text;
  badge: Text;
  objective: Text;
  minutes: string;
  workbench: { width: number; height: number };
  parts: PartDef[];
  axes: AxisDef[];
  slots: SlotDef[];
  steps: StepDef[];
  /** Mesh tolerance in workbench units for gear centre distance. */
  meshTolerance: number;
  success: { outputPart: string };
  reasons: Record<ReasonCode, Text>;
  status: Record<StatusCode, Text>;
  orientationNames: Record<string, Text>;
  reflection: { question: Text; options: { id: string; label: Text }[]; correct: string; explain: Text };
}

export interface Placement { partId: string; orientation: string }
export type Placements = Record<string, Placement>;
