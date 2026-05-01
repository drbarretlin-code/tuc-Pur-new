import React, { useState, useEffect, useRef } from 'react';
import { FileText, ZoomIn, FileJson, Download, Loader2 } from 'lucide-react';
import { t } from '../lib/i18n';
import type { Language } from '../lib/i18n';
import type { FormState } from '../types/form';
import { exportToWord, exportToPDF } from '../logic/exporter';
import { processAutoNumbering } from '../logic/specGenerator';

interface PaperProps {
  data: FormState;
  totalPages?: number;
  previewRef?: React.RefObject<HTMLDivElement | null>;
  id?: string;
}

const CooldownTimer: React.FC<{ language: Language }> = ({ language }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const target = (globalThis as any)._TUC_COOLDOWN_UNTIL || 0;
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  if (timeLeft === 0) return <>{t('aiTranslatingStatus', language)}</>;

  const text = language === 'th-TH' 
    ? `(API เต็มกำลัง รอคิวจัดสรร... ${timeLeft} วินาที)` 
    : `(API 滿載排程中... ${timeLeft} 秒)`;

  return <span>{text}</span>;
};

const PaperContent: React.FC<PaperProps> = ({ data, totalPages, previewRef, id }) => {
  const hasImages = data.images.length > 0;
  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return 'NA';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return dateStr as string;
    
    const locale = (data.language === 'th-TH' ? data.primaryLanguage : data.language) === 'th-TH' ? 'th-TH-u-ca-buddhist' : (data.language === 'en-US' ? 'en-US' : (data.language === 'zh-CN' ? 'zh-CN' : 'zh-TW'));
    return date.toLocaleDateString(locale);
  };

  const currentDate = formatDate(new Date());
  const deptKeyMap: Record<string, string> = {
    '生產部': 'dept_Production',
    '工程部': 'dept_Engineering',
    '工安部': 'dept_Safety',
    '設備部': 'dept_Equipment',
    '品保部': 'dept_Quality',
    '研發部': 'dept_RD',
    'PRD': 'dept_PRD',
    '採購部': 'dept_Purchasing'
  };

  const renderBilingualText = (val: string | null | undefined, isAutoNumber = false, cachedZh?: string, status?: 'typing' | 'pending' | 'success' | 'error' | 'cooldown') => {
    if (!val) return 'NA';
    
    // V28.x: 格式一致化處理 - 確保不論是否為預設值，渲染結構均保持對齊
    const formatLine = (main: string, sub?: string | React.ReactNode, isStatus = false) => {
      // 若原文與翻譯完全相同 (例如原文已經是中文)，則隱藏 sub 以避免疊影與冗餘
      const isDuplicate = !isStatus && typeof sub === 'string' && sub.trim() === main.trim();
      return (
        <div style={{ marginBottom: '4px' }}>
          <div style={{ fontWeight: 400, color: '#000' }}>{main}</div>
          {sub && !isDuplicate && (
            <div style={{ color: isStatus ? (status === 'error' ? '#E60012' : '#9ca3af') : '#666', fontSize: '0.9em', marginTop: '1px', paddingLeft: '8px', borderLeft: isStatus ? 'none' : '2px solid #ddd', fontStyle: isStatus ? 'italic' : 'normal' }}>
              {sub}
            </div>
          )}
        </div>
      );
    };

    if (val.startsWith('default')) {
      const mainText = data.language === 'th-TH' ? t(val, data.primaryLanguage) : t(val, data.language);
      const processedMain = isAutoNumber ? processAutoNumbering(mainText) : mainText;
      
      if (data.language === 'th-TH') {
        const secText = t(val, data.secondaryLanguage);
        const processedSec = isAutoNumber ? processAutoNumbering(secText) : secText;
        
        const mainLines = processedMain.split('\n');
        const secLines = processedSec.split('\n');
        
        return (
          <div className="bilingual-block">
            {mainLines.map((line: string, i: number) => formatLine(line, secLines[i]))}
          </div>
        );
      }
      return <div style={{ whiteSpace: 'pre-wrap' }}>{processedMain}</div>;
    }

    // 針對非預設文字 (使用者手動輸入)
    const content = isAutoNumber ? processAutoNumbering(val) : val;
    
    if (data.language === 'th-TH') {
      const hasThaiSource = /[\u0E00-\u0E7F]/.test(content);
      if (!hasThaiSource) {
        return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
      }

      // V29.x: 狀態提示
      if (status === 'cooldown') {
        const mainLines = content.split('\n');
        return (
          <div className="bilingual-block">
            {mainLines.map((line: string, i: number) => formatLine(line, i === mainLines.length - 1 ? <CooldownTimer language={data.language} /> : undefined, true))}
          </div>
        );
      }
      if (status === 'pending') {
        const mainLines = content.split('\n');
        return (
          <div className="bilingual-block">
            {mainLines.map((line: string, i: number) => formatLine(line, i === mainLines.length - 1 ? t('aiTranslatingStatus', data.language) : undefined, true))}
          </div>
        );
      }
      if (status === 'error') {
        const mainLines = content.split('\n');
        return (
          <div className="bilingual-block">
            {mainLines.map((line: string, i: number) => formatLine(line, i === mainLines.length - 1 ? t('aiTranslateError', data.language) : undefined, true))}
          </div>
        );
      }

      // V28.x: 增加內容相同判定 (加入 trim 防止空格干擾)，防止 AI 翻譯失敗回傳原文時出現「泰文+泰文」的冗餘
      if (cachedZh && cachedZh.trim() !== content.trim()) {
        const mainLines = content.split('\n');
        const zhLines = cachedZh.split('\n');
        return (
          <div className="bilingual-block">
            {mainLines.map((line: string, i: number) => formatLine(line, zhLines[i]))}
          </div>
        );
      }
    }

    return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
  };

  const renderBilingualLabel = (key: string) => {
    if (data.language === 'th-TH') {
      return (
        <span style={{ display: 'inline-block' }}>
          <span>{t(key, data.language)}</span>
          <br />
          <span style={{ color: '#666', fontSize: '0.85em', fontWeight: 'normal' }}>
            {t(key, 'zh-TW')}
          </span>
        </span>
      );
    }
    return t(key, data.language);
  };
  return (
    <div id={id} ref={previewRef} className="preview-content" style={{ 
      width: '210mm', minHeight: '297mm', background: 'white', padding: '15mm 20mm', boxShadow: '0 0 20px rgba(0,0,0,0.5)', position: 'relative', color: '#000', fontSize: '11pt', lineBreak: 'anywhere'
    }}>

      {/* Header */}
      <div style={{ borderBottom: '2.5px solid black', paddingBottom: '0.8rem', marginBottom: '1.2rem', position: 'relative' }}>
        <h1 style={{ textAlign: 'center', margin: '0', fontSize: '20pt' }}>
          {data.language === 'th-TH' ? 'Taiwan Union Technology (THAILAND) CO., LTD.' : t('docCompanyName', data.language)}
        </h1>
        {data.language !== 'th-TH' && (
          <h2 style={{ textAlign: 'center', margin: '0 0 0.4rem', fontSize: '14pt', fontWeight: 'normal' }}>
            {t('docCompanyEnglish', data.language)}
          </h2>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <h3 style={{ margin: '0', fontSize: '16pt', fontWeight: 'bold' }}>{t('docTitle', data.language)}</h3>
        </div>

        {/* 日期與頁碼容器 - 使用絕對定位固定在右側 */}
        <div style={{ position: 'absolute', right: 0, bottom: '0.8rem', textAlign: 'right' }}>
          <div style={{ fontSize: '9pt', color: '#666', marginBottom: '2px' }}>{t('docDate', data.language)}{currentDate}</div>
          <div style={{ fontSize: '11pt' }}>{t('docPage', data.language)}1 / {totalPages || 1}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '10pt' }}>
        <div>{renderBilingualLabel('docDept')}: {data.department || 'NA'}</div>
        <div>{renderBilingualLabel('docRequester')}: {data.requester || 'NA'} {data.extension ? `(${t('docExtension', data.language)}: ${data.extension})` : ''}</div>
      </div>

      {/* Sections I - X */}
      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ marginRight: '8px', whiteSpace: 'nowrap' }}>{renderBilingualLabel('docSection1')}</span>
          <span style={{ fontWeight: 'normal', flex: 1 }}>
            <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
              {renderBilingualText(data.equipmentName, false, data.bilingualCache?.equipmentName, data.bilingualStatus?.equipmentName)}
            </div>
            <span style={{ marginLeft: '8px', display: 'inline-block' }}>
              ({data.language === 'th-TH' 
                  ? renderBilingualLabel(data.category === '新增' ? 'catNew' : data.category === '修繕' ? 'catRepair' : data.category === '整改' ? 'catRenovate' : data.category === '優化' ? 'catOptimize' : data.category === '購置' ? 'catPurchase' : data.category) 
                  : data.category})
            </span>
          </span>
        </h4>
        <div style={{ marginLeft: '1.2rem', marginTop: '4px' }}>
          <strong>{renderBilingualLabel('reqDesc')}：</strong>
          <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{renderBilingualText(data.requirementDesc, false, data.bilingualCache?.requirementDesc, data.bilingualStatus?.requirementDesc)}</div>
        </div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection2')}</h4>
        <div style={{ marginLeft: '1.2rem', whiteSpace: 'pre-wrap', color: '#333' }}>{renderBilingualText(data.appearance, false, data.bilingualCache?.appearance, data.bilingualStatus?.appearance)}</div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection3')} <span style={{ fontWeight: 'normal' }}>{renderBilingualText(data.quantityUnit, false, data.bilingualCache?.quantityUnit, data.bilingualStatus?.quantityUnit)}</span></h4>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection4')}</h4>
        <div style={{ marginLeft: '1.2rem' }}>{renderBilingualText(data.equipmentScope, false, data.bilingualCache?.equipmentScope, data.bilingualStatus?.equipmentScope)}</div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection5')}</h4>
        <div style={{ marginLeft: '1.2rem', whiteSpace: 'pre-wrap' }}>{renderBilingualText(data.rangeRange, false, data.bilingualCache?.rangeRange, data.bilingualStatus?.rangeRange)}</div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection6')}</h4>
        <div style={{ marginLeft: '1.2rem' }}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{renderBilingualLabel('docSub6_1')}</div>
            {renderBilingualText(data.envRequirements, false, data.bilingualCache?.envRequirements, data.bilingualStatus?.envRequirements)}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{renderBilingualLabel('docSub6_2')}</div>
            {renderBilingualText(data.regRequirements, false, data.bilingualCache?.regRequirements, data.bilingualStatus?.regRequirements)}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{renderBilingualLabel('docSub6_3')}</div>
            {renderBilingualText(data.maintRequirements, false, data.bilingualCache?.maintRequirements, data.bilingualStatus?.maintRequirements)}
          </div>
        </div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection7')}</h4>
        <div style={{ marginLeft: '1.2rem', marginTop: '8px' }}>{renderBilingualText(data.safetyRequirements, false, data.bilingualCache?.safetyRequirements, data.bilingualStatus?.safetyRequirements)}</div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection8')}</h4>
        <div style={{ marginLeft: '1.2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1.5rem', marginTop: '8px' }}>
          <div style={{ border: '1px solid #ddd', padding: '6px 10px' }}>
            <div style={{ color: '#666', fontSize: '9pt', borderBottom: '1px solid #eee', marginBottom: '4px', paddingBottom: '2px', fontWeight: 'bold' }}>{renderBilingualLabel('docSub8_1')}</div>
            {renderBilingualText(data.elecSpecs, false, data.bilingualCache?.elecSpecs, data.bilingualStatus?.elecSpecs)}
          </div>
          <div style={{ border: '1px solid #ddd', padding: '6px 10px' }}>
            <div style={{ color: '#666', fontSize: '9pt', borderBottom: '1px solid #eee', marginBottom: '4px', paddingBottom: '2px', fontWeight: 'bold' }}>{renderBilingualLabel('docSub8_2')}</div>
            {renderBilingualText(data.mechSpecs, false, data.bilingualCache?.mechSpecs, data.bilingualStatus?.mechSpecs)}
          </div>
          <div style={{ border: '1px solid #ddd', padding: '6px 10px' }}>
            <div style={{ color: '#666', fontSize: '9pt', borderBottom: '1px solid #eee', marginBottom: '4px', paddingBottom: '2px', fontWeight: 'bold' }}>{renderBilingualLabel('docSub8_3')}</div>
            {renderBilingualText(data.physSpecs, false, data.bilingualCache?.physSpecs, data.bilingualStatus?.physSpecs)}
          </div>
          <div style={{ border: '1px solid #ddd', padding: '6px 10px' }}>
            <div style={{ color: '#666', fontSize: '9pt', borderBottom: '1px solid #eee', marginBottom: '4px', paddingBottom: '2px', fontWeight: 'bold' }}>{renderBilingualLabel('docSub8_4')}</div>
            {renderBilingualText(data.relySpecs, false, data.bilingualCache?.relySpecs, data.bilingualStatus?.relySpecs)}
          </div>
        </div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection9')}</h4>
        <div style={{ marginLeft: '1.2rem' }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '10pt' }}>{renderBilingualText(data.installStandard, true, data.bilingualCache?.installStandard, data.bilingualStatus?.installStandard)}</div>
          <div style={{ margin: '8px 0' }}><strong>{renderBilingualLabel('docSub9_date')}</strong> {formatDate(data.deliveryDate)} | <strong>{renderBilingualLabel('docSub9_period')}</strong> {data.workPeriod || 'NA'}</div>
          <strong>{renderBilingualLabel('docSub9_acceptance')}</strong>
          <div style={{ whiteSpace: 'pre-wrap' }}>{renderBilingualText(data.acceptanceDesc, false, data.bilingualCache?.acceptanceDesc, data.bilingualStatus?.acceptanceDesc)}</div>
        </div>
      </div>

      <div className="doc-section">
        <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection10')}</h4>
        <div style={{ marginLeft: '1.2rem', whiteSpace: 'pre-wrap', fontSize: '10pt' }}>{renderBilingualText(data.complianceDesc, true, data.bilingualCache?.complianceDesc, data.bilingualStatus?.complianceDesc)}</div>
      </div>

      {/* Conditional Sections XI & XII */}
      {hasImages && (
        <>
          <div className="doc-section" style={{ pageBreakBefore: 'always' }}>
            <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection11')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '10px' }}>
              {data.images.map(img => (
                <div key={img.id} style={{ textAlign: 'center', border: '1px solid #eee', padding: '8px' }}>
                  <img src={img.url} style={{ width: '100%', height: '180px', objectFit: 'contain' }} alt="" />
                  <div style={{ fontSize: '9pt', marginTop: '4px' }}>{img.caption}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 獨立渲染的第十二章節 */}

          <div className="doc-section">
            <h4 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>{renderBilingualLabel('docSection12')}</h4>
            <table style={{ border: '1px solid black', width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '9pt' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid black' }}>{t('docTblCat', data.language)}</th>
                  <th style={{ border: '1px solid black' }}>{t('docTblItem', data.language)}</th>
                  <th style={{ border: '1px solid black' }}>{t('docTblSpec', data.language)}</th>
                  <th style={{ border: '1px solid black' }}>{t('docTblMethod', data.language)}</th>
                  <th style={{ border: '1px solid black' }}>{t('docTblCount', data.language)}</th>
                  <th style={{ border: '1px solid black' }}>{t('docTblConfirm', data.language)}</th>
                </tr>
              </thead>
              <tbody>
                {data.tableData.map((row, i) => (
                  <tr key={i}>
                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderBilingualText(row.category, false, data.bilingualCache?.[`tableData_${i}_category`], data.bilingualStatus?.[`tableData_${i}_category`])}</td>
                    <td style={{ border: '1px solid black' }}>{renderBilingualText(row.item, false, data.bilingualCache?.[`tableData_${i}_item`], data.bilingualStatus?.[`tableData_${i}_item`])}</td>
                    <td style={{ border: '1px solid black' }}>{renderBilingualText(row.spec, false, data.bilingualCache?.[`tableData_${i}_spec`], data.bilingualStatus?.[`tableData_${i}_spec`])}</td>
                    <td style={{ border: '1px solid black' }}>{renderBilingualText(row.method, false, data.bilingualCache?.[`tableData_${i}_method`], data.bilingualStatus?.[`tableData_${i}_method`])}</td>
                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderBilingualText(row.samples, false, data.bilingualCache?.[`tableData_${i}_samples`], data.bilingualStatus?.[`tableData_${i}_samples`])}</td>
                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{renderBilingualText(row.confirmation, false, data.bilingualCache?.[`tableData_${i}_confirmation`], data.bilingualStatus?.[`tableData_${i}_confirmation`])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

      {/*規格確認及會簽*/}
      <div className="doc-section" style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
        <h4 style={{ textAlign: 'center', fontSize: '12pt', fontWeight: 'bold', marginBottom: '15px' }}>{renderBilingualLabel('docSignTitle')}</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid black', padding: '8px', width: '15%', background: '#f9f9f9' }}>{renderBilingualLabel('docSignApplicant')}</td>
              <td style={{ border: '1px solid black', padding: '8px', width: '35%' }}>{data.applicantName}</td>
              <td style={{ border: '1px solid black', padding: '8px', width: '15%', background: '#f9f9f9' }}>{renderBilingualLabel('docSignDeptHead')}</td>
              <td style={{ border: '1px solid black', padding: '8px', width: '35%' }}>{data.deptHeadName}</td>
            </tr>
            <tr>
              <td colSpan={3} style={{ border: '1px solid black', padding: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(3, minmax(35px, auto))' }}>
                  {data.signOffGrid.map((row, ri) => 
                    row.map((cell, ci) => {
                      const isDropdown = ci === 0 || ci === 2 || ci === 4;
                      const displayContent = isDropdown && deptKeyMap[cell] ? renderBilingualLabel(deptKeyMap[cell]) : cell;
                      return (
                        <div key={`${ri}-${ci}`} style={{ border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7.5pt', padding: '2px', textAlign: 'center', lineHeight: '1.2' }}>
                          {displayContent}
                        </div>
                      );
                    })
                  )}
                </div>
              </td>
              <td style={{ border: '1px solid black', padding: '8px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '4px' }}>{renderBilingualLabel('docSignVendor')}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="doc-section" style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
        <div style={{ color: '#E60012', fontSize: '9pt', marginBottom: '8px', fontWeight: 'bold' }}>
          {renderBilingualLabel('docBottomNote1')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '10pt' }}>
          <span>{renderBilingualLabel('docBottomNote2')}</span>
          <div style={{ display: 'flex', gap: '15px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', border: '1px solid black', borderRadius: '50%', background: data.needsDrawing === 'YES' ? 'black' : 'transparent', display: 'inline-block' }} /> {renderBilingualLabel('yes')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', border: '1px solid black', borderRadius: '50%', background: data.needsDrawing === 'NO' ? 'black' : 'transparent', display: 'inline-block' }} /> {renderBilingualLabel('no')}
            </span>
          </div>
        </div>
      </div>

      {/* 廠商注意事項 - A4 直向整頁 */}
      <div className="doc-section" style={{ pageBreakBefore: 'always', marginTop: '1.5rem' }}>
        <h4 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '2px solid #000', paddingBottom: '4px', marginBottom: '1.2rem' }}>
          {renderBilingualLabel('contractorNotice')}
        </h4>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '10pt', lineHeight: '1.6', color: '#000' }}>
          {renderBilingualText(data.contractorNotice, false, data.bilingualCache?.contractorNotice, data.bilingualStatus?.contractorNotice)}
        </div>
      </div>
    </div>
  );
};

interface Props {
  data: FormState;
}

const SpecPreview: React.FC<Props> = ({ data }) => {
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<'auto' | number>('auto');
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        if (zoomMode === 'auto') {
          const containerWidth = containerRef.current.offsetWidth - 40; 
          const containerHeight = containerRef.current.offsetHeight - 40;
          const targetWidth = 210 * 3.78; 
          const targetHeight = 297 * 3.78;
          if (containerWidth <= 0 || containerHeight <= 0) return; // V19.9: 防止高度塌陷導致比例為 0
          const scaleW = containerWidth / targetWidth;
          const scaleH = containerHeight / targetHeight;
          setScale(Math.max(0.1, Math.min(scaleW, scaleH, 1)));
        } else {
          setScale(zoomMode);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [zoomMode, data]);

  useEffect(() => {
    if (previewRef.current) {
      const height = previewRef.current.scrollHeight;
      const calculatedTotal = Math.max(1, Math.ceil(height / 1050)); 
      setTotalPages(calculatedTotal);
    }
  }, [data, scale]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportToPDF(data);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="preview-section glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {isExporting && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <Loader2 size={40} className="spin" color="#60A5FA" style={{ marginBottom: '1rem' }} />
          <div style={{ color: '#60A5FA', fontWeight: 'bold' }}>{t('exporting', data.language)}</div>
        </div>
      )}

      <style>{`
          @page {
            size: A4;
            margin: 15mm !important; /* 標準 A4 邊距，確保多頁穩定性 */
          }
          @media print {
            /* 強力隱藏瀏覽器標籤 (V19.8: 透過偽元素與內容抑制) */
            html, body {
              overflow: hidden !important; /* 防止產生額外的捲軸與標籤空間 */
              height: auto !important;
            }
            .doc-section {
              margin-bottom: 1.5rem !important; /* 主題間距，約一空行 */
              page-break-inside: auto !important; /* 允許文字內容跨頁切割 */
              break-inside: auto !important;
            }
            table, .doc-section table {
              page-break-inside: avoid !important; /* 表格框架禁止跨頁分割 */
              break-inside: avoid-page !important;
            }
            /* 隱藏瀏覽器預設的網址、日期、標題 */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            body * { visibility: hidden; }
            
            #preview-paper { 
              position: static !important;
              width: 100% !important; 
              margin: 0 !important; 
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              display: block !important;
            }
            #preview-paper, #preview-paper * {
              visibility: visible !important;
            }
            .no-print { display: none !important; }
            * { 
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
            }
          }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText color="#E60012" size={24} />
          <h3 style={{ margin: 0 }}>{t('docOfficialPreview', data.language)}</h3>
          <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
            <ZoomIn size={14} />
            <select 
              value={zoomMode === 'auto' ? 'auto' : zoomMode} 
              onChange={(e) => setZoomMode(e.target.value === 'auto' ? 'auto' : parseFloat(e.target.value))}
              style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '0.75rem', outline: 'none' }}
            >
              <option value="auto">{t('docAutoFit', data.language)}</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>

          <button onClick={() => exportToWord(data, data.language)} className="icon-btn">
            <FileJson size={18} /><span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>{t('docExportWord', data.language)}</span>
          </button>
          <button 
            onClick={handleExportPdf} 
            className="primary-button" 
            style={{ padding: '0.4rem 1rem' }}
            disabled={isExporting}
          >
            <Download size={16} /><span style={{ marginLeft: '4px' }}>{t('docExportPdf', data.language)}</span>
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: '#333', 
        padding: '1rem', 
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center'
      }}>
        <div className="preview-zoom-container" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
          <PaperContent data={data} totalPages={totalPages} previewRef={previewRef} id="preview-paper" />
        </div>
      </div>
    </div>
  );
};

export default React.memo(SpecPreview);
