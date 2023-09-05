import * as bril from './bril.ts';

export function instrToString(instr: bril.Instruction): string {
  if (instr.op == 'const') {
    const type_annotation = 'type' in instr ? `: ${instr.type}` : '';
    return `${instr.dest}${type_annotation} = const ${instr.value}`;
  }

  let rhs = instr.op;
  if (instr.funcs) {
    rhs += ` ${instr.funcs.map((f) => `@${f}`).join(' ')}`;
  }
  if (instr.args) {
    rhs += ` ${instr.args.join(' ')}`;
  }
  if (instr.labels) {
    rhs += ` ${instr.labels.map((f) => `.${f}`).join(' ')}`;
  }
  if ('dest' in instr) {
    const type_annotation = 'type' in instr ? `: ${instr.type}` : '';
    return `${instr.dest}${type_annotation} = ${rhs}`;
  }
  return rhs;
}
