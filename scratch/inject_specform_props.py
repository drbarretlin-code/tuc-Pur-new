import re

file_path = '/Users/barretlin/Antigravity/tuc-Purchase-new/src/components/SpecForm.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace SectionEditor language prop
content = content.replace("language={data.language === 'th-TH' ? data.primaryLanguage : data.language}", "language={data.language}")

# 2. Replace Category label and options
pattern_label = r"\{data\.language === 'th-TH' \? `\$\{t\('category', 'th-TH'\)\} / \$\{t\('category', 'zh-TW'\)\}` : t\('category', data\.language\)\}"
content = re.sub(pattern_label, "{t('category', data.language)}", content)

categories = ['catNew', 'catRepair', 'catRenovate', 'catOptimize', 'catPurchase']
for cat in categories:
    pattern_cat = r"\{data\.language === 'th-TH' \? `\$\{t\('" + cat + r"', 'th-TH'\)\} / \$\{t\('" + cat + r"', 'zh-TW'\)\}` : t\('" + cat + r"', data\.language\)\}"
    content = re.sub(pattern_cat, "{t('" + cat + r"', data.language)}", content)

# 3. Replace any other ternary checks for language
content = content.replace("if (data.language === 'th-TH' && typeof value === 'string' && data.bilingualStatus?.[field as string] === 'error')", "if (typeof value === 'string' && data.bilingualStatus?.[field as string] === 'error')")
content = content.replace("if (data.language === 'th-TH') {", "if (data.primaryLanguage !== data.secondaryLanguage) {")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
