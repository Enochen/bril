import * as bril from './bril.ts';
import { Line, formBlocks } from './form_blocks.ts';
import { readStdin } from './util.ts';

// Trivial form of dead code elimination, returns true if instructions changed
function eliminateDeadCode(func: bril.Function): boolean {
  const blocks = [...formBlocks(func)];

  // Track things we cannot delete
  const used = new Set<string>();
  for (const block of blocks) {
    for (const instr of block) {
      if ('args' in instr) {
        instr.args?.forEach((arg) => used.add(arg));
      }
    }
  }

  let dirty = false;

  function* cleanBlock(block: Iterable<Line>) {
    for (const instr of block) {
      if ('dest' in instr && !used.has(instr.dest)) {
        dirty = true;
        continue;
      }
      yield instr;
    }
  }

  func.instrs = blocks.flatMap((b) => [...cleanBlock(b)]);

  return dirty;
}

function optimizeLocal(func: bril.Function) {
  while (eliminateDeadCode(func)) {
    // iterate to convergence!
  }
}

if (import.meta.main) {
  const program = JSON.parse(await readStdin()) as bril.Program;
  program.functions.forEach(optimizeLocal);

  const json = JSON.stringify(program, undefined, 2);
  await Deno.stdout.write(new TextEncoder().encode(json));
}
