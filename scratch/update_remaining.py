import re

def safe_replace(content, func_name, replacement):
    # This assumes we find the function name and then carefully replace the body.
    pass

def main():
    with open('src/lib/knowledgeParser.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. translateCloudMetadata
    pattern_cloud = r'''  const discovery = await getAutoSelectedModel\(apiKey\);
  if \(!discovery\) return items;
  const \{ modelId, apiKey: workingKey \} = discovery;
  const genAI = new GoogleGenerativeAI\(workingKey\);
  const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);

  const payload = items\.map\(\(item, idx\) => \(\{ idx, id: item\.id, name: item\.name, tags: item\.tags \|\| \[\] \}\)\);
  const prompt = `Translate the following items into \$\{targetLang\}\. Return ONLY a JSON array\.
  Payload: \$\{JSON\.stringify\(payload\)\}`;

  try \{
    trackGeminiUsage\(modelId\);
    const result = await model\.generateContent\(prompt\);'''

    repl_cloud = '''  const payload = items.map((item, idx) => ({ idx, id: item.id, name: item.name, tags: item.tags || [] }));
  const prompt = `Translate the following items into ${targetLang}. Return ONLY a JSON array.
  Payload: ${JSON.stringify(payload)}`;

  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });
      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    content = content.replace(pattern_cloud, repl_cloud)


    # 2. translateFormFields
    pattern_form = r'''  const discovery = await getAutoSelectedModel\(apiKey\);
  if \(!discovery\) return items\.map\(i => \(\{ id: i\.id, translatedText: i\.text \}\)\);

  const \{ modelId, apiKey: workingKey \} = discovery;
  const genAI = new GoogleGenerativeAI\(workingKey\);
  const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);

  const prompt = `Translate the 'text' field of the following JSON array into \$\{targetLang\}\.
  Return ONLY a JSON array with 'id' and 'translatedText'\.
  Payload: \$\{JSON\.stringify\(items\)\}`;

  try \{
    trackGeminiUsage\(modelId\);
    const result = await model\.generateContent\(prompt\);'''

    repl_form = '''  const prompt = `Translate the 'text' field of the following JSON array into ${targetLang}.
  Return ONLY a JSON array with 'id' and 'translatedText'.
  Payload: ${JSON.stringify(items)}`;

  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });
      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    content = content.replace(pattern_form, repl_form)


    # 3. translateFullSpec
    pattern_spec = r'''  const discovery = await getAutoSelectedModel\(apiKey\);
  if \(!discovery\) return data;

  const \{ modelId, apiKey: workingKey \} = discovery;
  const genAI = new GoogleGenerativeAI\(workingKey\);
  const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);

  const prompt = `Translate this procurement specification JSON into \$\{targetLang\}\. Return ONLY the JSON\.
  JSON: \$\{JSON\.stringify\(data\)\}`;

  try \{
    trackGeminiUsage\(modelId\);
    const result = await model\.generateContent\(prompt\);'''

    repl_spec = '''  const prompt = `Translate this procurement specification JSON into ${targetLang}. Return ONLY the JSON.
  JSON: ${JSON.stringify(data)}`;

  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });
      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    content = content.replace(pattern_spec, repl_spec)


    # 4. translateFullBilingualState
    pattern_bilingual = r'''  const discovery = await getAutoSelectedModel\(apiKey\);
  if \(!discovery\) return payload;

  const \{ modelId, apiKey: workingKey \} = discovery;
  const genAI = new GoogleGenerativeAI\(workingKey\);
  const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);

  const prompt = `Translate all specification contents into \$\{targetLang\}\.
  Return ONLY the translated JSON\.
  INPUT: \$\{JSON\.stringify\(payload\)\}`;

  try \{
    trackGeminiUsage\(modelId\);
    const result = await model\.generateContent\(prompt\);'''

    repl_bilingual = '''  const prompt = `Translate all specification contents into ${targetLang}.
  Return ONLY the translated JSON.
  INPUT: ${JSON.stringify(payload)}`;

  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });
      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    content = content.replace(pattern_bilingual, repl_bilingual)

    with open('src/lib/knowledgeParser.ts', 'w', encoding='utf-8') as f:
        f.write(content)
        print("Updated correctly")

if __name__ == '__main__':
    main()
