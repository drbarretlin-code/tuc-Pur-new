import re
import os

file_path = '/Users/barretlin/Documents/Antigravity_Files/tuc-Purchase-main/src/components/SpecForm.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find SectionEditor calls and inject bilingual props
# We look for value={data.FIELD} and extract FIELD
def inject_props(match):
    full_call = match.group(0)
    # Extract field name from value={data.FIELD}
    val_match = re.search(r'value=\{data\.(\w+)\}', full_call)
    if val_match:
        field = val_match.group(1)
        # Avoid double injection
        if 'bilingualStatus' in full_call:
            return full_call
        
        insertion = f'\n                    bilingualStatus={{data.bilingualStatus?.["{field}"]}}\n                    cachedSrc={{data.bilingualCache?.["{field}_src"]}}'
        # Insert before language={data.language} or at the end of props
        if 'language={data.language}' in full_call:
            return full_call.replace('language={data.language}', insertion + '\n                    language={data.language}')
        else:
            return full_call.replace('/>', insertion + '\n                  />')
    return full_call

# Regex for SectionEditor component calls
# Matches <SectionEditor ... /> even across multiple lines
new_content = re.sub(r'<SectionEditor.*?\/>', inject_props, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SpecForm.tsx updated with bilingual status props.")
