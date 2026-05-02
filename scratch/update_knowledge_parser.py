import re
import sys

def main():
    file_path = 'src/lib/knowledgeParser.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace the `getAutoSelectedModel` calls and `model.generateContent` calls.
    # Because the code structures vary slightly, we will do targeted replacements for each function.

    # 1. processFileToKnowledge
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(pool\);[\s\S]*?const prompt = `',
        r'const prompt = `',
        content,
        count=1
    )
    
    # In processFileToKnowledge, inlineData is used. 
    # The generation happens here:
    gen_content_pattern_1 = r'''    try \{
      const contents: any\[\] = \[\{ role: 'user', parts: \[\{ text: prompt \}\] \}\];
      
      if \(inlineData\) \{
        contents\[0\].parts.push\(\{ inlineData \}\);
      \}

      trackGeminiUsage\(cachedModelId\);
      const result = await model.generateContent\(\{
        contents,
        generationConfig: \{
          maxOutputTokens: 8192,
          temperature: 0.2,
          topP: 0.8,
          topK: 40
        \}
      \}\).catch\(err => \{'''

    replacement_1 = '''    try {
      const result = await aiQueue.enqueue(async () => {
        const discovery = await getAutoSelectedModel(pool);
        if (!discovery) throw new Error(t('aiError', lang));
        const { modelId, apiKey: workingKey } = discovery;
        recordKeyUsage(workingKey);
        trackGeminiUsage(modelId);
        
        const genAI = new GoogleGenerativeAI(workingKey);
        const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

        const contents: any[] = [{ role: 'user', parts: [{ text: sanitizePrompt(prompt) }] }];
        if (inlineData) {
          contents[0].parts.push({ inlineData });
        }

        return await model.generateContent({
          contents,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.2,
            topP: 0.8,
            topK: 40
          }
        });
      }).catch(err => {'''
    
    content = content.replace(gen_content_pattern_1.replace('\\{', '{').replace('\\[', '[').replace('\\]', ']').replace('\\}', '}').replace('\\(', '(').replace('\\)', ')'), replacement_1)

    # 2. translateSearchQueries
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(apiKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*const prompt = `',
        r'const prompt = `',
        content,
        count=1
    )
    
    content = content.replace(
        '''    trackGeminiUsage(cachedModelId);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });''',
        '''    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('AI Error');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });
      
      return await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: sanitizePrompt(prompt) }] }],
        generationConfig: { temperature: 0.1 }
      });
    });'''
    )

    # 3. syncFormDataToKnowledge
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(finalKey\);[\s\S]*?const genAI = new GoogleGenerativeAI\(workingKey\);\s*const docId = data\.docId;',
        r'const docId = data.docId;',
        content,
        count=1
    )
    
    content = content.replace(
        '''  try {
    const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

    trackGeminiUsage(cachedModelId);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });''',
        '''  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(finalKey);
      if (!discovery) throw new Error('AI 同步失敗：無可用模型');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: sanitizePrompt(prompt) }] }]
      });
    });'''
    )

    # 4. assembleJsonFromExistingEntries
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(rawKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*trackGeminiUsage\(cachedModelId\);\s*const result = await model\.generateContent\(\{[\s\S]*?\}\);',
        '''const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(rawKey);
      if (!discovery) throw new Error('AI 組裝失敗：無可用模型');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: sanitizePrompt(prompt) }] }]
      });
    });''',
        content,
        count=1
    )

    # 5. translateHints
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(apiKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*const langMap: Record<string, string> =',
        r'const langMap: Record<string, string> =',
        content,
        count=1
    )
    content = content.replace(
        '''  try {
    trackGeminiUsage(modelId);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, topP: 0.8, topK: 40 }
    });''',
        '''  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: sanitizePrompt(prompt) }] }],
        generationConfig: { temperature: 0.1, topP: 0.8, topK: 40 }
      });
    });'''
    )

    # 6. translateCloudMetadata
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(apiKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*const payload =',
        r'const payload =',
        content,
        count=1
    )
    content = content.replace(
        '''  try {
    trackGeminiUsage(modelId);
    const result = await model.generateContent(prompt);''',
        '''  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    )

    # 7. translateFormFields
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(apiKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*const prompt = `',
        r'const prompt = `',
        content,
        count=1
    )
    content = content.replace(
        '''  try {
    trackGeminiUsage(modelId);
    const result = await model.generateContent(prompt);''',
        '''  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    )

    # 8. translateTableData
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(apiKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*const prompt = `',
        r'const prompt = `',
        content,
        count=1
    )
    content = content.replace(
        '''  try {
    trackGeminiUsage(modelId);
    const result = await model.generateContent(prompt);''',
        '''  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    )

    # 9. analyzeSystemMetrics
    content = re.sub(
        r'const discovery = await getAutoSelectedModel\(apiKey\);[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: modelId, safetySettings \}\);\s*const prompt = `',
        r'const prompt = `',
        content,
        count=1
    )
    content = content.replace(
        '''  try {
    trackGeminiUsage(modelId);
    const result = await model.generateContent(prompt);''',
        '''  try {
    const result = await aiQueue.enqueue(async () => {
      const discovery = await getAutoSelectedModel(apiKey);
      if (!discovery) throw new Error('NO_KEY');
      const { modelId, apiKey: workingKey } = discovery;
      recordKeyUsage(workingKey);
      trackGeminiUsage(modelId);
      const genAI = new GoogleGenerativeAI(workingKey);
      const model = genAI.getGenerativeModel({ model: modelId, safetySettings });

      return await model.generateContent(sanitizePrompt(prompt));
    });'''
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Updated knowledgeParser.ts successfully.")

if __name__ == '__main__':
    main()
