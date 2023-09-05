import { readStdin } from './util.ts';
import * as bril from './bril.ts';
import { instrToString } from './briltxt.ts';

const TERMINATORS = new Set(['br', 'jmp', 'ret']);

export type Line = bril.Instruction | bril.Label;

export type Block = Line[];

export function* formBlocks(func: bril.Function): Generator<Block> {
  let block = [];
  for (const instr of func.instrs) {
    if ('op' in instr) {
      block.push(instr);
      if (instr.op in TERMINATORS) {
        yield block;
        block = [];
      }
    } else {
      if (block.length) {
        yield block;
      }
      block = [];
      block.push(instr);
    }
  }
  if (block.length) {
    yield block;
  }
}

function printBlocks(prog: bril.Program) {
  for (const [index, func] of prog.functions.entries()) {
    console.log(`Function ${index}:`);
    console.log();
    for (const block of formBlocks(func)) {
      const leader = block[0];
      if ('label' in leader) {
        console.log(`block ${leader.label}:`);
      } else {
        console.log(`anonymous block:`);
      }
      for (const instr of block) {
        console.log(instrToString(instr as bril.Instruction));
      }
      console.log();
    }
  }
}

if (import.meta.main) {
  const program = JSON.parse(await readStdin()) as bril.Program;
  printBlocks(program);
}
