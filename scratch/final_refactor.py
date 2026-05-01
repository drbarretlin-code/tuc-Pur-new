import re
import os

with open('knowledgeParser_v520.ts', 'r', encoding='utf-8') as f:
    v520 = f.read()

new_get_auto = """export async function getAutoSelectedModel(keys: string | string[]): Promise<{ modelId: string; apiKey: string }> {
  if (typeof keys === 'string') keys = [keys];
  const priorityList = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
  ];

  if (!(globalThis as any)._TUC_INVALID_MODELS) (globalThis as any)._TUC_INVALID_MODELS = new Set<string>();
  const invalidModels = (globalThis as any)._TUC_INVALID_MODELS;

  if (!(globalThis as any)._TUC_RPD_EXHAUSTED_SET) (globalThis as any)._TUC_RPD_EXHAUSTED_SET = new Set<string>();
  const rpdExhaustedSet: Set<string> = (globalThis as any)._TUC_RPD_EXHAUSTED_SET;

  const keyHealthJson = localStorage.getItem('_TUC_KEY_HEALTH') || '{}';
  const keyHealth = JSON.parse(keyHealthJson);
  const now = Date.now();

  const rpdResetKey = new Date().toISOString().split('T')[0];
  if (localStorage.getItem('_TUC_RPD_DAY') !== rpdResetKey) {
    (globalThis as any)._TUC_RPD_EXHAUSTED_SET = new Set<string>();
    localStorage.setItem('_TUC_RPD_DAY', rpdResetKey);
  }

  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    if (!currentKey) continue;
    const keyId = currentKey.substring(0, 10);
    if (keyHealth[keyId] && now < keyHealth[keyId]) continue;

    for (const mId of priorityList) {
      if (invalidModels.has(mId)) continue; 
      if (rpdExhaustedSet.has(`${keyId}_${mId}`)) continue;
      
      cachedModelId = mId;
      localStorage.setItem('tuc_gemini_key', currentKey);
      return { modelId: mId, apiKey: currentKey };
    }
  }
  return { modelId: priorityList[0], apiKey: keys[0] };
}"""

new_sync = """
/**
 * V30.3: 單次全量翻譯同步
 */
export async function translateFullBilingualState(
  payload: Record<string, string>,
  targetLang: string,
  apiKeys: string | string[]
): Promise<Record<string, string>> {
  if (Object.keys(payload).length === 0) return {};
  const { modelId, apiKey: workingKey } = await getAutoSelectedModel(apiKeys);
  const genAI = new GoogleGenerativeAI(workingKey);
  const model = genAI.getGenerativeModel({ model: modelId, safetySettings });
  const prompt = `You are a professional Thai-Chinese procurement spec translator.
Translate the following JSON object's values from Thai into Traditional Chinese (Taiwan).
Return ONLY the translated JSON object with the same keys.
Keep technical terms (PLC, SUS304, HMI, ISO) in English.

INPUT:
${JSON.stringify(payload)}`;

  try {
    trackGeminiUsage(cachedModelId);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err: any) {
    const errMsg = err.message || '';
    if (errMsg.includes('503') || errMsg.includes('429')) {
      const isRPD = errMsg.includes('PerDay');
      if (isRPD) {
        const rpdKey = `${workingKey.substring(0, 10)}_${cachedModelId}`;
        if (!(globalThis as any)._TUC_RPD_EXHAUSTED_SET) (globalThis as any)._TUC_RPD_EXHAUSTED_SET = new Set<string>();
        (globalThis as any)._TUC_RPD_EXHAUSTED_SET.add(rpdKey);
      } else {
        const keyId = workingKey.substring(0, 10);
        const health = JSON.parse(localStorage.getItem('_TUC_KEY_HEALTH') || '{}');
        health[keyId] = Date.now() + 60000;
        localStorage.setItem('_TUC_KEY_HEALTH', JSON.stringify(health));
      }
      invalidateCachedModel();
      if (Array.isArray(apiKeys) && apiKeys.length > 0) return translateFullBilingualState(payload, targetLang, apiKeys);
    }
    throw err;
  }
}
"""

# Match the function more carefully
pattern = r"export async function getAutoSelectedModel\(keys: string \| string\[\]\): Promise<\{ modelId: string; apiKey: string \}> \{.*?^\}"
v520_fixed = re.sub(pattern, new_get_auto, v520, flags=re.DOTALL | re.MULTILINE)

with open('src/lib/knowledgeParser.ts', 'w', encoding='utf-8') as f:
    f.write(v520_fixed + new_sync)

print("Refactor complete.")
