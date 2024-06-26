export type Identifier = '{}' | '[]'
export interface Parameter {
  key: string
  value: string
}

export function parsePrompt(
  prompt: string,
  parameters: Parameter[],
  identifier: Identifier,
) {
  parameters.forEach(param => {
    prompt = prompt.replace(
      identifier[0] + param.key + identifier[1],
      param.value,
    )
  })

  return prompt
}
