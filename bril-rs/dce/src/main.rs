use bbb::{form_blocks, Block};
use bril_rs::{load_program_from_read, output_program, Function, Instruction, Program};
use std::{collections::HashSet, io};

fn get_args(instr: &Instruction) -> Vec<String> {
    match instr {
        Instruction::Value { args, .. } => args.clone(),
        Instruction::Effect { args, .. } => args.clone(),
        _ => Vec::new(),
    }
}

fn find_used(blocks: &Vec<Block>) -> HashSet<String> {
    blocks
        .iter()
        .flat_map(|block| block.instrs.iter().flat_map(|instr| get_args(instr)))
        .collect()
}

fn trivial_dce(mut func: &Function) {
    let blocks = form_blocks(func);
    let used = find_used(&blocks);
}

fn global_dce(program: &Program) {}

fn main() -> io::Result<()> {
    let mut program = load_program_from_read(io::stdin());

    for func in &program.functions {
        trivial_dce(func);
    }

    global_dce(&program);

    output_program(&program);
    Ok(())
}
