import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, CheckCircle, Download, FileType, Info,
  Loader2, Terminal, Trash2, Zap
} from 'lucide-react';
import { initPyodide, getFontFeatures, processFont, type FreezeResult } from './pyodideService';

// وصف الخصائص بالعربي
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  ss01: 'مجموعة أسلوبية 1', ss02: 'مجموعة أسلوبية 2', ss03: 'مجموعة أسلوبية 3',
  ss04: 'مجموعة أسلوبية 4', ss05: 'مجموعة أسلوبية 5', ss06: 'مجموعة أسلوبية 6',
  ss07: 'مجموعة أسلوبية 7', ss08: 'مجموعة أسلوبية 8', ss09: 'مجموعة أسلوبية 9',
  ss10: 'مجموعة أسلوبية 10', ss11: 'مجموعة أسلوبية 11', ss12: 'مجموعة أسلوبية 12',
  ss13: 'مجموعة أسلوبية 13', ss14: 'مجموعة أسلوبية 14', ss15: 'مجموعة أسلوبية 15',
  ss16: 'مجموعة أسلوبية 16', ss17: 'مجموعة أسلوبية 17', ss18: 'مجموعة أسلوبية 18',
  ss19: 'مجموعة أسلوبية 19', ss20: 'مجموعة أسلوبية 20',
  cv01: 'متغير حرف 1', cv02: 'متغير حرف 2', cv03: 'متغير حرف 3',
  cv04: 'متغير حرف 4', cv05: 'متغير حرف 5', cv06: 'متغير حرف 6',
  cv07: 'متغير حرف 7', cv08: 'متغير حرف 8', cv09: 'متغير حرف 9',
  cv10: 'متغير حرف 10',
  swsh: 'حركات زخرفية (Swash)', titl: 'أحرف عنوانية',
  salt: 'بدائل أسلوبية', aalt: 'كل البدائل',
  smcp: 'أحرف صغيرة', c2sc: 'أحرف كبيرة لصغيرة',
  dlig: 'ربط اختياري', hlig: 'ربط تاريخي',
  lnum: 'أرقام كبيرة', onum: 'أرقام قديمة',
  pnum: 'أرقام متناسبة', tnum: 'أرقام جدولية',
  frac: 'كسور', zero: 'صفر مشطوب',
  ordn: 'ترتيبات', subs: 'حروف سفلية', sups: 'حروف علوية',
  mgrk: 'يونانية رياضية', ornm: 'زخرفات',
};

// مفتاح فريد للخطوط
let fontKeyCounter = 0;

function App() {
  const [isPyodideLoading, setIsPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState('');
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontUrl, setFontUrl] = useState<string>('');
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [fontKey, setFontKey] = useState(0);

  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [frozenFeatures, setFrozenFeatures] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewText, setPreviewText] = useState(
    'بسم الله الرحمن الرحيم\nأهلاً وسهلاً بك في أداة تجميد الخطوط\nHello World - OpenType Features'
  );
  const [fontSize, setFontSize] = useState(36);

  const [logs, setLogs] = useState<Array<{ type: 'info' | 'success' | 'error'; text: string }>>([]);
  const [lastResult, setLastResult] = useState<FreezeResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: 'info' | 'success' | 'error', text: string) => {
    setLogs(prev => [...prev, { type, text }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 100);
  }, []);

  useEffect(() => {
    addLog('info', '⏳ جاري تحميل محرك Python + FontTools...');
    initPyodide()
      .then(() => {
        setIsPyodideLoading(false);
        addLog('success', '✅ تم تحميل المحرك بنجاح! يمكنك رفع الخط الآن.');
      })
      .catch((err) => {
        console.error('Pyodide Load Error', err);
        setPyodideError('فشل في تحميل محرك الخطوط. تأكد من اتصالك بالإنترنت.');
        addLog('error', `❌ فشل تحميل المحرك: ${err.message || err}`);
      });
  }, [addLog]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFontFile(file);
    setLastResult(null);
    const url = URL.createObjectURL(file);
    setFontUrl(url);
    fontKeyCounter++;
    setFontKey(fontKeyCounter);

    const buffer = await file.arrayBuffer();
    setFontBuffer(buffer);

    addLog('info', `📂 تم رفع: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    addLog('info', '🔍 جاري تحليل خصائص الخط...');

    try {
      const result = await getFontFeatures(buffer);
      if (result.error) {
        addLog('error', `❌ خطأ في قراءة الخصائص: ${result.error}`);
        setAvailableFeatures([]);
        setFrozenFeatures([]);
      } else {
        setAvailableFeatures(result.features);
        setFrozenFeatures(result.frozenFeatures || []);
        setSelectedFeatures(result.frozenFeatures || []);

        if (result.features.length > 0) {
          addLog('success', `✅ تم العثور على ${result.features.length} خاصية اختيارية: ${result.features.join(', ')}`);
        } else {
          addLog('info', '⚠️ لا توجد خصائص اختيارية (مثل ss01) في هذا الخط.');
        }

        if (result.frozenFeatures && result.frozenFeatures.length > 0) {
          addLog('info', `🧊 الخط يحتوي على خصائص مجمّدة مسبقاً: ${result.frozenFeatures.join(', ')}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      addLog('error', `❌ خطأ غير متوقع: ${err.message || err}`);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.ttf') || file.name.endsWith('.otf'))) {
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, []);

  const toggleFeature = useCallback((feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  }, []);

  const selectAll = () => setSelectedFeatures([...availableFeatures]);
  const deselectAll = () => setSelectedFeatures([]);

  const featuresToFreeze = selectedFeatures.filter(f => !frozenFeatures.includes(f));
  const featuresToUnfreeze = frozenFeatures.filter(f => !selectedFeatures.includes(f));
  const hasChanges = featuresToFreeze.length > 0 || featuresToUnfreeze.length > 0;

  const handleProcessAndDownload = async () => {
    if (!fontBuffer || !fontFile || !hasChanges) return;

    setIsProcessing(true);
    setLastResult(null);

    if (featuresToFreeze.length > 0 && featuresToUnfreeze.length > 0) {
      addLog('info', `🔧 تجميد: ${featuresToFreeze.join(', ')} | إلغاء تجميد: ${featuresToUnfreeze.join(', ')}`);
    } else if (featuresToFreeze.length > 0) {
      addLog('info', `🔧 بدء التجميد: ${featuresToFreeze.join(', ')}`);
    } else {
      addLog('info', `🔧 بدء إلغاء التجميد: ${featuresToUnfreeze.join(', ')}`);
    }

    try {
      const { result, bytes } = await processFont(fontBuffer, selectedFeatures);
      setLastResult(result);

      if (!result.success) {
        addLog('error', `❌ فشلت العملية: ${result.error}`);
        return;
      }

      const actionText =
        result.action === 'unfreeze' ? 'إلغاء التجميد' :
        result.action === 'mixed' ? 'التعديل' : 'التجميد';
      addLog('success', `✅ تم ${actionText} بنجاح!`);
      addLog('info', `   📊 عدد الـ Lookups المعدلة: ${result.lookups_count}`);
      addLog('info', `   🎯 تم التعديل في: ${result.injected_into?.join(', ')}`);

      if (result.name_changes && result.name_changes.length > 0) {
        if (result.action === 'unfreeze') {
          addLog('info', `   ✏️ تم إزالة "mob" من الاسم: ${result.name_changes.length} حقل`);
        } else {
          addLog('info', `   ✏️ تم إضافة "mob" للاسم: ${result.name_changes.length} حقل`);
        }
      }

      if (bytes) {
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'font/ttf' });
        const url = URL.createObjectURL(blob);

        setFrozenFeatures([...selectedFeatures]);

        const a = document.createElement('a');
        a.href = url;

        const dotIdx = fontFile.name.lastIndexOf('.');
        const baseName = dotIdx > 0 ? fontFile.name.substring(0, dotIdx) : fontFile.name;
        const ext = dotIdx > 0 ? fontFile.name.substring(dotIdx) : '.ttf';

        let finalBaseName = baseName;
        if (result.action === 'unfreeze') {
          finalBaseName = baseName
            .replace(/[\s-]?mob$/i, '')
            .replace(/[\s-]?mob([\s-])/i, '$1');
        } else if (!baseName.toLowerCase().includes('mob')) {
          finalBaseName = baseName + '-mob';
        }

        a.download = finalBaseName + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addLog('success', `📥 تم تحميل: ${a.download} (${(bytes.length / 1024).toFixed(1)} KB)`);
      }
    } catch (err: any) {
      console.error(err);
      addLog('error', `❌ خطأ غير متوقع: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    if (fontUrl) URL.revokeObjectURL(fontUrl);
    setFontFile(null);
    setFontUrl('');
    setFontBuffer(null);
    setAvailableFeatures([]);
    setFrozenFeatures([]);
    setSelectedFeatures([]);
    setLastResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    addLog('info', '🗑️ تم إعادة التعيين.');
  };

  const getPreviewStyle = (): React.CSSProperties => {
    if (!fontUrl) return {};

    const baseStyle: React.CSSProperties = {
      fontFamily: `"PreviewFont-${fontKey}", sans-serif`,
      fontSize: `${fontSize}px`,
      lineHeight: 1.8,
    };

    if (selectedFeatures.length > 0) {
      (baseStyle as any).fontFeatureSettings = selectedFeatures.map(f => `"${f}" 1`).join(', ');
    }

    return baseStyle;
  };

  const fontFaceCSS = fontUrl
    ? `@font-face { font-family: "PreviewFont-${fontKey}"; src: url("${fontUrl}"); }`
    : '';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFF4EB' }} dir="rtl">
      {fontUrl && <style>{fontFaceCSS}</style>}

      {/* الهيدر */}
      <header className="relative overflow-hidden" style={{ backgroundColor: '#6E9840' }}>
        {/* زخارف هندسية في الخلفية */}
        <div className="absolute inset-0 pointer-events-none">
          {/* دوائر زخرفية */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: '#FFF4EB' }} />
          <div className="absolute -bottom-24 -right-12 w-80 h-80 rounded-full opacity-10" style={{ backgroundColor: '#FFF4EB' }} />
          <div className="absolute top-8 left-1/3 w-32 h-32 rounded-full opacity-5" style={{ backgroundColor: '#FFF4EB' }} />
          {/* خطوط زخرفية */}
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-5"
            style={{ background: 'linear-gradient(135deg, #FFF4EB 25%, transparent 25%) -10px 0, linear-gradient(225deg, #FFF4EB 25%, transparent 25%) -10px 0', backgroundSize: '20px 20px' }}
          />
          {/* مستطيل شفاف */}
          <div className="absolute bottom-0 left-0 right-0 h-1 opacity-20" style={{ backgroundColor: '#FFF4EB' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* الجزء النصي */}
            <div className="flex-1">
              {/* شارة الأداة */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-bold tracking-wide"
                style={{ backgroundColor: 'rgba(255,244,235,0.2)', color: '#FFF4EB', border: '1px solid rgba(255,244,235,0.3)' }}>
                <Zap className="w-3.5 h-3.5" />
                أداة خطوط مجانية · تعمل في المتصفح
              </div>
              <h1 className="text-3xl md:text-4xl font-black mb-3 leading-tight" style={{ color: '#FFF4EB' }}>
                المجمّد الآمن
                <span className="block text-2xl md:text-3xl font-bold opacity-90 mt-1">لخصائص OpenType</span>
              </h1>
              <p className="text-sm md:text-base max-w-xl leading-relaxed" style={{ color: 'rgba(255,244,235,0.8)' }}>
                جمّد خصائص الخطوط (ss01, swash, وغيرها) لتصبح افتراضية — بحقن Lookups داخل الخصائص الإجبارية
                بدون المساس بـ cmap مع الحفاظ على الحروف الوسطية والاتصالات للعربي.
              </p>
              {/* إحصائيات سريعة */}
              <div className="flex flex-wrap gap-4 mt-5">
                {[
                  { label: 'يدعم TTF & OTF', icon: '📁' },
                  { label: 'خصوصية تامة', icon: '🔒' },
                  { label: 'بدون خادم', icon: '⚡' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: 'rgba(255,244,235,0.9)' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* البطاقة الزخرفية على اليمين */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="relative w-44 h-44">
                {/* دائرة خارجية */}
                <div className="absolute inset-0 rounded-full opacity-15" style={{ backgroundColor: '#FFF4EB' }} />
                {/* دائرة داخلية */}
                <div className="absolute inset-4 rounded-full opacity-20" style={{ backgroundColor: '#FFF4EB' }} />
                {/* المحتوى */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2 shadow-lg"
                    style={{ backgroundColor: '#FFF4EB' }}>
                    <Zap className="w-8 h-8" style={{ color: '#6E9840' }} />
                  </div>
                  <p className="text-xs font-bold" style={{ color: '#FFF4EB' }}>Font Freezer</p>
                  <p className="text-[10px] opacity-70" style={{ color: '#FFF4EB' }}>v2.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* موجة سفلية */}
        <div className="relative" style={{ height: '32px' }}>
          <svg viewBox="0 0 1440 32" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path d="M0,16 C360,32 1080,0 1440,16 L1440,32 L0,32 Z" fill="#FFF4EB" />
          </svg>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* العمود الأيمن: الإعدادات */}
          <div className="lg:col-span-2 space-y-5">

            {/* رفع الخط */}
            <div className="p-5 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: '#d4e8b8' }}>
              <input
                type="file"
                accept=".ttf,.otf"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />

              {isPyodideLoading ? (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: '#6E9840' }} />
                  <h3 className="text-lg font-semibold text-slate-800">جاري تحميل المحرك...</h3>
                  <p className="text-slate-500 text-sm mt-2">تجهيز Python + FontTools داخل المتصفح</p>
                </div>
              ) : pyodideError ? (
                <div className="text-center py-8 text-red-600">
                  <p className="font-semibold">{pyodideError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 underline" style={{ color: '#6E9840' }}
                  >
                    إعادة تحميل
                  </button>
                </div>
              ) : !fontFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer text-center transition-colors"
                  style={{ borderColor: '#6E9840', backgroundColor: 'rgba(110,152,64,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(110,152,64,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(110,152,64,0.05)')}
                >
                  <UploadCloud className="w-12 h-12 mb-3" style={{ color: '#6E9840' }} />
                  <h3 className="text-lg font-bold text-slate-800 mb-1">ارفع ملف الخط</h3>
                  <p className="text-slate-500 text-sm">اسحب وأفلت أو اضغط — يدعم TTF و OTF</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(110,152,64,0.08)', borderColor: '#d4e8b8' }}>
                  <FileType className="w-8 h-8 flex-shrink-0" style={{ color: '#6E9840' }} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm truncate" dir="ltr">{fontFile.name}</h3>
                    <p className="text-xs text-slate-500">{(fontFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={resetAll} className="text-slate-400 hover:text-red-500 transition-colors" title="حذف">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* تنبيه لا خصائص */}
            {fontFile && availableFeatures.length === 0 && !isPyodideLoading && (
              <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ backgroundColor: 'rgba(110,152,64,0.08)', borderColor: '#d4e8b8' }}>
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#6E9840' }} />
                <p className="text-sm" style={{ color: '#4a6e25' }}>لم يتم العثور على خصائص اختيارية في هذا الخط.</p>
              </div>
            )}

            {/* اختيار الخصائص */}
            {availableFeatures.length > 0 && (
              <div className="p-5 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: '#d4e8b8' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" style={{ color: '#6E9840' }} />
                    الخصائص المتاحة ({availableFeatures.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs px-2 py-1 rounded-lg transition-colors font-medium"
                      style={{ color: '#6E9840', backgroundColor: 'rgba(110,152,64,0.1)' }}
                    >
                      تحديد الكل
                    </button>
                    <button
                      onClick={deselectAll}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 bg-slate-50 rounded-lg transition-colors"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {availableFeatures.map(feat => {
                    const isSelected = selectedFeatures.includes(feat);
                    const isFrozen = frozenFeatures.includes(feat);
                    const willFreeze = isSelected && !isFrozen;
                    const willUnfreeze = !isSelected && isFrozen;

                    return (
                      <label
                        key={feat}
                        className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all text-sm select-none"
                        style={isSelected ? {
                          borderColor: '#6E9840',
                          backgroundColor: 'rgba(110,152,64,0.08)',
                          color: '#4a6e25',
                        } : {
                          borderColor: '#e2e8d5',
                          backgroundColor: 'white',
                        }}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ accentColor: '#6E9840' }}
                          checked={isSelected}
                          onChange={() => toggleFeature(feat)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-sm">{feat}</span>
                            {isFrozen && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(110,152,64,0.15)', color: '#4a6e25' }}>مجمّد</span>
                            )}
                            {willFreeze && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">+ تجميد</span>
                            )}
                            {willUnfreeze && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">- إلغاء</span>
                            )}
                          </div>
                          {FEATURE_DESCRIPTIONS[feat] && (
                            <p className="text-xs text-slate-500 truncate">{FEATURE_DESCRIPTIONS[feat]}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* ملخص التغييرات */}
                {hasChanges && (
                  <div className="mt-4 p-3 rounded-xl text-xs space-y-1" style={{ backgroundColor: 'rgba(110,152,64,0.07)', border: '1px solid #d4e8b8' }}>
                    {featuresToFreeze.length > 0 && (
                      <p className="text-green-700">
                        <span className="font-bold">+ سيتم تجميد:</span> {featuresToFreeze.join(', ')}
                      </p>
                    )}
                    {featuresToUnfreeze.length > 0 && (
                      <p className="text-red-700">
                        <span className="font-bold">- سيتم إلغاء:</span> {featuresToUnfreeze.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleProcessAndDownload}
                  disabled={!hasChanges || isProcessing}
                  className="mt-5 w-full py-3.5 px-6 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                  style={hasChanges && !isProcessing ? { backgroundColor: '#6E9840' } : {}}
                  onMouseEnter={e => { if (hasChanges && !isProcessing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#5a7e34'; }}
                  onMouseLeave={e => { if (hasChanges && !isProcessing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6E9840'; }}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {isProcessing
                    ? 'جاري المعالجة...'
                    : hasChanges
                    ? 'تطبيق التعديلات وتحميل الخط'
                    : 'اختر خصائص للتعديل'}
                </button>

                {/* نتيجة آخر عملية */}
                {lastResult && (
                  <div
                    className="mt-4 p-3 rounded-xl text-sm"
                    style={lastResult.success ? {
                      backgroundColor: 'rgba(110,152,64,0.1)',
                      border: '1px solid #d4e8b8',
                      color: '#4a6e25'
                    } : {
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b'
                    }}
                  >
                    {lastResult.success ? (
                      <div>
                        <p className="font-bold">✅ تم بنجاح!</p>
                        <p className="mt-1">
                          • {lastResult.lookups_count} Lookup تم تعديلها في:{' '}
                          {lastResult.injected_into?.join('، ')}
                        </p>
                      </div>
                    ) : (
                      <p className="font-bold">❌ {lastResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* العمود الأيسر: المعاينة + السجل */}
          <div className="lg:col-span-3 space-y-5">

            {/* المعاينة الحية */}
            <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: 'white', borderColor: '#d4e8b8' }}>
              <div className="border-b px-5 py-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(110,152,64,0.06)', borderColor: '#d4e8b8' }}>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-800 text-sm">👁️ المعاينة الفورية</h3>
                  {selectedFeatures.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(110,152,64,0.15)', color: '#4a6e25' }}>
                      {selectedFeatures.length} خاصية مفعّلة
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500">الحجم:</label>
                  <input
                    type="range"
                    min="16"
                    max="80"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-24"
                    style={{ accentColor: '#6E9840' }}
                  />
                  <span className="text-xs text-slate-600 font-mono w-8">{fontSize}</span>
                </div>
              </div>

              <div className="p-5">
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="w-full h-20 p-3 rounded-xl focus:outline-none resize-none text-sm border"
                  style={{ backgroundColor: 'rgba(110,152,64,0.04)', borderColor: '#d4e8b8' }}
                  placeholder="اكتب هنا لتجربة الخط..."
                  dir="auto"
                />

                <div className="mt-4 border rounded-xl p-6 min-h-[200px] flex items-center justify-center overflow-auto"
                  style={{ background: 'linear-gradient(135deg, white, #FFF4EB)', borderColor: '#e8d8c8' }}>
                  {!fontUrl ? (
                    <p className="text-slate-400 text-sm">ارفع خطاً لرؤية المعاينة</p>
                  ) : (
                    <div
                      style={getPreviewStyle()}
                      className="text-slate-900 w-full whitespace-pre-wrap break-words"
                      dir="auto"
                    >
                      {previewText || 'اكتب شيئاً...'}
                    </div>
                  )}
                </div>

                {/* عرض CSS المستخدم */}
                {selectedFeatures.length > 0 && fontUrl && (
                  <div className="mt-3 rounded-lg p-3 overflow-x-auto" style={{ backgroundColor: '#1a2e0e' }}>
                    <p className="text-xs font-mono" style={{ color: '#a3d977' }} dir="ltr">
                      font-feature-settings: {selectedFeatures.map(f => `"${f}" 1`).join(', ')};
                    </p>
                  </div>
                )}

                {/* تنبيه للخصائص المجمدة */}
                {frozenFeatures.length > 0 && featuresToUnfreeze.length > 0 && (
                  <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'rgba(110,152,64,0.08)', border: '1px solid #d4e8b8' }}>
                    <p className="text-xs" style={{ color: '#4a6e25' }}>
                      ⚠️ الخصائص المجمّدة ({featuresToUnfreeze.join(', ')}) محقونة داخل الخط.
                      المعاينة ستظهر التغيير الفعلي بعد الضغط على "تطبيق التعديلات".
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* سجل العمليات */}
            <div className="rounded-2xl shadow-sm overflow-hidden border" style={{ backgroundColor: '#0f1f07', borderColor: '#2a4a14' }}>
              <div className="px-5 py-3 flex items-center gap-2 border-b" style={{ backgroundColor: '#1a2e0e', borderColor: '#2a4a14' }}>
                <Terminal className="w-4 h-4" style={{ color: '#6E9840' }} />
                <h3 className="font-bold text-sm" style={{ color: '#a3d977' }}>سجل العمليات</h3>
                <button
                  onClick={() => setLogs([])}
                  className="mr-auto text-xs transition-colors"
                  style={{ color: '#4a6e25' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#a3d977')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4a6e25')}
                >
                  مسح
                </button>
              </div>
              <div
                ref={logRef}
                className="p-4 max-h-[250px] overflow-y-auto font-mono text-xs space-y-1"
                dir="auto"
              >
                {logs.length === 0 ? (
                  <p style={{ color: '#2a4a14' }}>لا توجد عمليات بعد...</p>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        color: log.type === 'success' ? '#a3d977' : log.type === 'error' ? '#f87171' : '#6b9e3a'
                      }}
                    >
                      {log.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* الفوتر */}
      <footer className="border-t mt-12" style={{ backgroundColor: 'white', borderColor: '#d4e8b8' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#6E9840' }}>
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-bold" style={{ color: '#6E9840' }}>Font Freezer</span>
          </div>
          <p className="text-xs text-slate-500 text-center">
            جميع العمليات تتم داخل متصفحك — لا يتم رفع أي ملف لخوادم خارجية. يستخدم Pyodide + FontTools.
          </p>
          <div className="text-xs" style={{ color: '#6E9840' }}>🔒 خصوصية 100%</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
