import * as bril from './bril.ts';
import { Block, Line, isLabel } from './bril_util.ts';
import { readStdin } from './util.ts';
import { formBlocks } from './form_blocks.ts';

let variableCounter = 0;
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
  if (value.op == 'add' || value.op == 'mul') {
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

function fold(value: Value): bril.Value | undefined {
  try {
    switch (value.op) {
      case 'const':
        return value.value;
      case 'id': {
        const v = table[cloud.get(lookup(value.args[0]))!].value;
        if (v === undefined) {
          throw 'something went wrong';
        }
        return fold(v);
      }
      case 'add': {
        const foldedArgs = value.args.map((arg) =>
          fold(table[cloud.get(lookup(arg))!].value)
        );
        if (foldedArgs.some((v) => v === undefined)) {
          throw 'something went wrong';
        }
        const [v1, v2] = foldedArgs;
        return (v1 as number) + (v2 as number);
      }
      case 'mul': {
        const foldedArgs = value.args.map((arg) =>
          fold(table[cloud.get(lookup(arg))!].value)
        );
        if (foldedArgs.some((v) => v === undefined)) {
          throw 'something went wrong';
        }
        const [v1, v2] = foldedArgs;
        return (v1 as number) * (v2 as number);
      }
    }
  } catch (_) {
    // If anything goes wrong, just return undefined
  }
  return undefined;
}

// Returns canonical variable of value that input variable refers to
function lookup(variable: Variable): Variable {
  const index = cloud.get(variable);
  if (index === undefined) {
    throw `Mapping does not exist for variable ${variable} in cloud`;
  }
  // Hack to support input args without using up a table entry
  if (index === -1) {
    return variable;
  }
  const { variables } = table[index];
  if (variables.length === 0) {
    throw `Table entry for ${variable} is missing canonical variable`;
  }
  return variables[0];
}

function updateCloud(variable: Variable, tableIndex: number) {
  const oldIndex = cloud.get(variable);
  if (oldIndex !== undefined && oldIndex >= 0) {
    table[oldIndex].variables.filter((v) => v !== variable);
  }
  cloud.set(variable, tableIndex);
}

function updateTable(value: Value) {
  const valueStr = JSON.stringify(value);
  if (valueIndex.has(valueStr)) {
    // We've already seen value
    const tableIndex = valueIndex.get(valueStr)!;
    return { index: tableIndex, entry: table[tableIndex] };
  } else {
    // This is a new value
    const tableIndex = table.length;
    valueIndex.set(valueStr, tableIndex);
    table.push({ value, variables: [] });
    return { index: tableIndex };
  }
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

function setupInputArgs(block: Block) {
  // Find all input args (names that are used before defined by an instruction)
  const args = new Set<string>();
  const defined = new Set<string>();
  for (const instr of block) {
    if ('args' in instr) {
      instr.args?.forEach((arg) => {
        if (!defined.has(arg)) args.add(arg);
      });
    }
    if ('dest' in instr) {
      defined.add(instr.dest);
    }
  }
  for (const arg of args) {
    // Add all args into cloud
    cloud.set(arg, -1);
  }
}

function* applyLVN(block: Block): Iterable<Line> {
  table.length = 0;
  valueIndex.clear();
  cloud.clear();

  setupInputArgs(block);
  const lastWrites = getLastWrites(block);
  for (let [lineIndex, instr] of block.entries()) {
    if (isLabel(instr)) {
      yield instr;
      continue;
    }
    if ('args' in instr) {
      instr.args = instr.args?.map(lookup);
    }
    if ('dest' in instr) {
      if (instr.op === 'call') {
        updateCloud(instr.dest, -1);
        yield instr;
        continue;
      }
      let value = canonicalize(toValue(instr));
      const foldedValue = fold(value);
      if (foldedValue !== undefined) {
        instr = {
          dest: instr.dest,
          op: 'const',
          type: instr.type,
          value: foldedValue,
        } as const;
        value = toValue(instr);
      }
      const { index, entry } = updateTable(value);
      if (lineIndex !== lastWrites.get(instr.dest)) {
        // instr will be overwritten later
        // register original name in cloud for later lookups
        updateCloud(instr.dest, index);
        // change name to throwaway for DCE to clean up easier
        instr.dest = `lvn_temp_${variableCounter++}`;
      }
      if (entry !== undefined && foldedValue === undefined) {
        // Replace instruction with id that can be cleaned up with DCE
        instr = { ...instr, op: 'id', args: [entry.variables[0]] };
      } else {
        table[index].variables.push(instr.dest);
      }
      // Remove old mapping if applicable
      updateCloud(instr.dest, index);
    }
    yield instr;
  }
}

const program = JSON.parse(await readStdin()) as bril.Program;
program.functions.forEach((func) => {
  const blocks = [...formBlocks(func)];
  func.instrs = blocks.flatMap((b) => [...applyLVN(b)]);
});

const json = JSON.stringify(program, undefined, 2);
await Deno.stdout.write(new TextEncoder().encode(json));
