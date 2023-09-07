import { timestamp } from 'https://esm.sh/typescript@5.0.4';
import * as bril from './bril.ts';
import { Block, Line, getArgs, isLabel } from './bril_util.ts';
import { readStdin } from './util.ts';
import { formBlocks } from './form_blocks.ts';
import { open } from 'https://esm.sh/v131/node_inspector.js';

type Value =
  | {
      op: bril.ValueOperation['op'];
      args: string[];
    }
  | {
      op: bril.Constant['op'];
      value: bril.Value;
    };

type ValueString = string;
type Variable = string;
type TableEntry = {
  value: Value;
  variables: Variable[];
};

const canonicalize = (value: Value) => {
  // TODO: Add more commutative operations
  if (value.op == 'add') {
    return { op: value.op, args: [...value.args].sort() };
  }
  return value;
};

function toValue(instr: bril.ValueOperation | bril.Constant): Value {
  if (instr.op == 'const') {
    return { op: instr.op, value: instr.value };
  }
  return { op: instr.op, args: instr.args || [] };
}

// Stores (index, value, canonical variable)
const table: TableEntry[] = [];

// Maps string representation of value to its index in [table]
const valueIndex: Map<ValueString, number> = new Map();

// Maps variable name to index in [table] containing its value
const cloud: Map<Variable, number> = new Map();

// Returns canonical variable of value that input variable refers to
function lookup(variable: Variable): Variable {
  const index = cloud.get(variable);
  if (index === undefined) {
    throw `Mapping does not exist for variable ${variable} in cloud`;
  }
  const { variables } = table[index];
  if (variables.length === 0) {
    throw `Table entry for ${variable} is missing canonical variable`;
  }
  return variables[0];
}

// Maps variable name to the index of the last instruction it gets written to
function getLastWrites(block: Block) {
  const result = new Map<Variable, number>();
  for (const [index, instr] of block.entries()) {
    if ('dest' in instr) {
      result.set(instr.dest, index);
    }
  }
  return result;
}

function* applyLVN(block: Block): Iterable<Line> {
  const lastWrites = getLastWrites(block);
  for (const [index, instr] of block.entries()) {
    if (isLabel(instr)) {
      continue;
    }
    if ('args' in instr) {
      instr.args = instr.args?.map(lookup);
    }
    if ('dest' in instr) {
      const value = canonicalize(toValue(instr));
      const valueStr = JSON.stringify(value);
      let tableIndex = -1;
      if (valueIndex.has(valueStr)) {
        // We've already seen value
        tableIndex = valueIndex.get(valueStr)!;
        const { variables } = table[tableIndex];
        // Replace instruction with id that can be cleaned up with DCE
        yield { ...instr, op: 'id', args: [variables[0]] };
      } else {
        // This is a new value
        tableIndex = table.length;
        if (index !== lastWrites.get(instr.dest)) {
          // instr will be overwritten later
          instr.dest = `lvn_temp_${tableIndex}`;
        }
        valueIndex.set(valueStr, tableIndex);
        table.push({ value, variables: [instr.dest] });
        cloud.set(instr.dest, tableIndex);
        yield { ...instr };
      }
      // Remove old mapping if applicable
      const oldIndex = cloud.get(instr.dest);
      if (oldIndex !== undefined) {
        table[oldIndex].variables.filter((v) => v !== instr.dest);
      }
      cloud.set(instr.dest, tableIndex);
    } else {
      yield instr;
    }
  }
}

const program = JSON.parse(await readStdin()) as bril.Program;
program.functions.forEach((func) => {
  const blocks = [...formBlocks(func)];
  func.instrs = blocks.flatMap((b) => [...applyLVN(b)]);
});

const json = JSON.stringify(program, undefined, 2);
await Deno.stdout.write(new TextEncoder().encode(json));
