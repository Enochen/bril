use bril_rs::{EffectOps, Function, Instruction, ValueOps};

#[derive(Default, Clone)]
pub struct Block {
    pub label: Option<String>,
    pub instrs: Vec<Instruction>,
}

pub fn is_terminator(instr: &Instruction) -> bool {
    matches!(
        instr,
        Instruction::Effect {
            op: EffectOps::Branch | EffectOps::Jump | EffectOps::Return,
            ..
        }
    )
}

pub fn form_blocks(func: &Function) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut current_block = Block::default();
    for code in &func.instrs {
        match code {
            bril_rs::Code::Label { label, .. } => {
                blocks.push(current_block.clone());
                current_block = Block::default();
                current_block.label = Some(label.clone());
            }
            bril_rs::Code::Instruction(instr) => {
                current_block.instrs.push(instr.clone());
                if is_terminator(instr) {
                    blocks.push(current_block.clone());
                    current_block = Block::default();
                }
            }
        }
    }
    return blocks;
}

fn format_funcs(funcs: &Vec<String>) -> String {
    return funcs.iter().map(|s| format!(" @{s}")).collect::<String>();
}

fn format_args(args: &Vec<String>) -> String {
    return args.iter().map(|s| format!(" {s}")).collect::<String>();
}

fn format_labels(labels: &Vec<String>) -> String {
    return labels.iter().map(|s| format!(" .{s}")).collect::<String>();
}

fn format_rhs(
    op: &String,
    funcs: &Vec<String>,
    args: &Vec<String>,
    labels: &Vec<String>,
) -> String {
    return format!(
        "{}{}{}{}",
        op,
        format_funcs(funcs),
        format_args(args),
        format_labels(labels)
    );
}

pub fn instr_to_txt(instr: &Instruction) -> String {
    match instr {
        Instruction::Constant {
            dest,
            const_type,
            value,
            ..
        } => format!("{}: {} = const {}", dest, const_type, value),
        Instruction::Value {
            dest,
            op_type,
            op,
            funcs,
            args,
            labels,
            ..
        } => format!(
            "{}: {} = {}",
            dest,
            op_type,
            format_rhs(&op.to_string(), funcs, args, labels)
        ),
        Instruction::Effect {
            op,
            funcs,
            args,
            labels,
            ..
        } => format_rhs(&op.to_string(), funcs, args, labels),
    }
}
