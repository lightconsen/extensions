---
name: JSON 提示生成器
---

{
"task": "生成特定任务的 JSON 格式提示",
"input\_format": {
"type": "object",
"properties": {
"TASK": {
"type": "string",
"description": "原始任务描述"
}
},
"required": \["TASK"]
},
"output\_format": {
"type": "object",
"properties": {
"task\_description": {
"type": "string",
"description": "对原始任务的简洁且正式的重述"
},
"requirements": {
"type": "array",
"items": {
"type": "string",
"description": "任务执行的具体要求"
}
},
"output\_format": {
"type": "object",
"description": "预期输出格式的详细规范"
},
"output\_example": {
"type": "object",
"description": "预期输出的示例"
},
"resources": {
"type": "array",
"items": {
"type": "string",
"description": "任务所需的资源或工具"
}
},
"evaluation\_criteria": {
"type": "array",
"items": {
"type": "string",
"description": "任务成功完成的评估标准"
}
},
"error\_handling": {
"type": "array",
"items": {
"type": "string",
"description": "处理常见问题或边缘情况的指导"
}
},
"ethical\_considerations": {
"type": "array",
"items": {
"type": "string",
"description": "相关的伦理或合规要求"
}
},
"conclusion": {
"type": "string",
"description": "确认所有要求均已满足的最终提醒"
}
},
"required": \[
"task\_description",
"requirements",
"output\_format",
"output\_example",
"evaluation\_criteria",
"conclusion"
]
},
"rules": \[
"生成的提示必须是有效的 JSON 格式",
"在 task\_description 开头包含原始 TASK",
"对任何模糊概念提供详细解释",
"使用简洁、直接的语言，保持专业、中立的语气",
"除非任务需要，避免使用行话或难懂的术语",
"确保提示可直接执行，无需额外说明",
"任务描述前不包含任何引导性文本",
"指定预期输出的格式、长度和结构",
"包含符合指定格式的输出示例",
"明确任务范围，避免范围蔓延",
"如适用，包含获取反馈或执行迭代的说明",
"提供处理常见问题或异常情况的指导"
],
"instructions": "给定一个任务描述（TASK），生成一个全面的 JSON 格式提示以指导任务执行。遵循以下步骤：\n1. 分析 TASK 以理解其需求和背景。\n2. 创建包含所有输出格式规定字段的 JSON 对象。\n3. 确保 task\_description 准确且简洁、正式地重述原始 TASK。\n4. 将具体要求、资源、评估标准和错误处理指令列为独立数组。\n5. 提供详细的 output\_format 对象及相应的 output\_example。\n6. 在 task\_description 中包含必要的背景信息或上下文。\n7. 如相关，指定伦理考虑或合规要求。\n8. 以确认所有要求已满足的提醒结束。\n9. 审核生成的提示，确保其符合所有规则且可直接执行。"
}

