import * as bril from './bril.ts';

export type Line = bril.Instruction | bril.Label;

export type Block = Line[];

export function isLabel(line: Line): line is bril.Label {
  return 'label' in line;
}

export function isInstruction(line: Line): line is bril.Instruction {
  return 'op' in line;
}

export function getArgs(instr: bril.Instruction) {
  return 'args' in instr ? instr.args : undefined;
}
