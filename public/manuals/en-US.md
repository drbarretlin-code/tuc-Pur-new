# TUC Procurement Specs & Knowledge Base - User Manual (V530.1)

Welcome to the TUC Intelligent Procurement System. This manual will guide you through the core features to achieve efficient and standardized specification creation.

---

## 1. Special Functions 🚀

The system integrates deep learning and cloud data to provide the following core features:

- ✨ **AI Regenerate**: Click the 🔄 **Regenerate** button, and the AI will precisely match similar clauses from the cloud knowledge base based on the current equipment name and requirements description to auto-fill suggestions.
- ☁️ **Import from Cloud**: Open the 🗄️ **Import from Cloud** window to search and retrieve historical specifications stored in the knowledge base and apply them to the editor.
- 📤 **Upload to Database**: Upload locally parsed raw documents to the cloud for the AI to learn and transform into structured technical entries.
- 📊 **Dashboard**: View the list of cloud-stored specs, parsing progress, and resource usage status.

---

## 2. Main Editor Operations ✍️

The main editor is the core area for building specifications. Key functions are defined below:

- 📄 **DocID**: A unique hidden ID for each document. When syncing to the knowledge base, the system uses this ID to determine whether to "Create New" or "Overwrite Existing".
- 📥 **File Options**:
    - 📥 **Download Spec JSON**: Save your current progress as a local backup for offline editing.
    - 🗄️ **Import from Cloud**: Quickly reference existing templates from the knowledge base.
    - 📂 **Load Local JSON**: Read a previously backed-up JSON file back into the editor.
- 🗑️ **Reset**: Clear all fields in the editor to start a new case from scratch.

---

## 3. Matching Threshold Adjustment ⚙️

The system provides two key threshold settings to customize the breadth and precision of AI suggestions:

- 🔄 **History Match Threshold**: Adjust the strictness for retrieving suggestions from "Historical Procurement Specs". A higher threshold (0.8+) results in more precise but fewer items; lowering it provides more reference inspiration.
- 📖 **Regulation Match Threshold**: Adjust the strictness for retrieving suggestions from "External Regulations & Industry Standards" to ensure compliance.

---

## 4. Universal Bilingual Display Architecture 🌐

The system has fully adopted a bilingual side-by-side display architecture. Regardless of interface language, all specification documents are presented in "Primary Language on Top, Secondary Language Below" format:

- 🔤 **Auto Bilingual Generation**: After Bilingual Sync, the system simultaneously produces corresponding clauses in both the primary and secondary languages, requiring no additional action.
  - **Example** (Chinese + Thai):
    > Primary (Chinese): 電源供應器，額定電壓 220V AC，50Hz
    > Secondary (Thai): แหล่งจ่ายไฟ แรงดันไฟฟ้าที่กำหนด 220V AC, 50Hz
- ☁️ **Auto Bilingual Expansion on Cloud Import**: When loading historical specs from the cloud, the system automatically syncs bilingual fields, updating both the editor and preview area in real time.
  - **Example** (English + Chinese):
    > Primary (English): Insulation Class: F, Ambient Temperature: -10°C ~ +50°C
    > Secondary (Chinese): 絕緣等級：F 級，環境溫度：-10°C ~ +50°C
- 📄 **Bilingual Export Format**: Both Word and PDF exports include a complete bilingual table with primary and secondary languages in separate rows, compliant with international procurement standards.
- ⚙️ **Instant Language Switch**: After switching the interface language, the bilingual display order in both the editor and preview area adjusts automatically, without reloading the document.

---

## 5. Preview Area 📄

The preview area provides a 1:1 visual representation of the print output:

- 🔍 **Preview Zoom %**: Use the 🔍 zoom functions to check layout details across different screen sizes.
- 📥 **Export Word**: Produces a standard `.docx` file, including full table structures and bilingual content.
- 👁️ **Export PDF**: Calls the print dialog to output high-quality A4 PDF documents.

---

## 6. Finalize Sync & Archiving 📥

After the specifications are verified, please perform the final step:

- ✅ **Finalize & Sync to Knowledge Base**:
    - **When to use**: When the document review is complete and you are ready to issue the procurement request.
    - **Purpose**: Saves this final version to the cloud so your technical knowledge can be searched and referenced by future applicants, enabling corporate knowledge transfer.

---
*Version: V530.1 | Update Date: 2026-05-02 | Tech Support: Dr. Barret Lin*
