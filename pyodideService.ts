export interface FreezeResult {
  success: boolean;
  error?: string;
  lookups_count?: number;
  injected_into?: string[];
  source_features?: string[];
  name_changes?: any[];
  action?: 'freeze' | 'unfreeze' | 'mixed';
}

let pyodide: any = null;

const pythonScript = `
from fontTools.ttLib import TTFont
from io import BytesIO
import re

def get_features_py(font_bytes):
    font = TTFont(BytesIO(font_bytes))
    
    optional_tags = ['ss01', 'ss02', 'ss03', 'ss04', 'ss05', 'ss06', 'ss07', 'ss08', 'ss09', 'ss10',
                   'ss11', 'ss12', 'ss13', 'ss14', 'ss15', 'ss16', 'ss17', 'ss18', 'ss19', 'ss20',
                   'cv01', 'cv02', 'cv03', 'cv04', 'cv05', 'cv06', 'cv07', 'cv08', 'cv09', 'cv10',
                   'swsh', 'titl', 'salt', 'aalt', 'smcp', 'c2sc', 'dlig', 'hlig', 'lnum', 'onum',
                   'pnum', 'tnum', 'frac', 'zero', 'ordn', 'subs', 'sups', 'mgrk', 'ornm']
                   
    def get_table_features(table_tag):
        if table_tag not in font: return {}
        table = font[table_tag].table
        if not hasattr(table, 'FeatureList') or not table.FeatureList: return {}
        
        feats = {}
        for record in table.FeatureList.FeatureRecord:
            tag = record.FeatureTag
            if tag not in feats:
                feats[tag] = set()
            feats[tag].update(record.Feature.LookupListIndex)
        return feats

    gsub_feats = get_table_features('GSUB')
    gpos_feats = get_table_features('GPOS')
    
    available = set(gsub_feats.keys()).union(gpos_feats.keys())
    available_optional = [tag for tag in available if tag in optional_tags]
    
    # Mandatory tags where we inject
    gsub_mandatory = ['rlig', 'rclt', 'calt', 'liga']
    gpos_mandatory = ['kern', 'dist', 'mark', 'mkmk', 'curs']
    
    frozen_features = []
    
    for tag in available_optional:
        gsub_lookups = gsub_feats.get(tag, set())
        is_frozen_gsub = True
        if gsub_lookups:
            found_in_any = False
            for m_tag in gsub_mandatory:
                if m_tag in gsub_feats and gsub_lookups.issubset(gsub_feats[m_tag]):
                    found_in_any = True
                    break
            if not found_in_any:
                is_frozen_gsub = False
                
        gpos_lookups = gpos_feats.get(tag, set())
        is_frozen_gpos = True
        if gpos_lookups:
            found_in_any = False
            for m_tag in gpos_mandatory:
                if m_tag in gpos_feats and gpos_lookups.issubset(gpos_feats[m_tag]):
                    found_in_any = True
                    break
            if not found_in_any:
                is_frozen_gpos = False
                
        if is_frozen_gsub and is_frozen_gpos and (gsub_lookups or gpos_lookups):
            frozen_features.append(tag)

    return {
        "available": available_optional,
        "frozen": frozen_features
    }

def freeze_features_py(font_bytes, features_to_freeze):
    font = TTFont(BytesIO(font_bytes))
    
    features_to_freeze = set(features_to_freeze)
    info = get_features_py(font_bytes)
    currently_frozen = set(info['frozen'])
    
    features_to_unfreeze = currently_frozen - features_to_freeze
    features_to_add = features_to_freeze - currently_frozen
    
    # Determine the action type
    if features_to_add and features_to_unfreeze:
        action = 'mixed'
    elif features_to_unfreeze:
        action = 'unfreeze'
    else:
        action = 'freeze'
    
    def process_table(table_tag, mandatory_tags):
        if table_tag not in font: return 0, []
        table = font[table_tag].table
        if not hasattr(table, 'FeatureList') or not table.FeatureList: return 0, []
        
        lookups_to_remove = set()
        for record in table.FeatureList.FeatureRecord:
            if record.FeatureTag in features_to_unfreeze:
                lookups_to_remove.update(record.Feature.LookupListIndex)
                
        lookups_to_add = set()
        for record in table.FeatureList.FeatureRecord:
            if record.FeatureTag in features_to_add:
                lookups_to_add.update(record.Feature.LookupListIndex)
                
        changes = 0
        injected = set()
        
        for record in table.FeatureList.FeatureRecord:
            if record.FeatureTag in mandatory_tags:
                new_lookups = [l for l in record.Feature.LookupListIndex if l not in lookups_to_remove]
                for l in lookups_to_add:
                    if l not in new_lookups:
                        new_lookups.append(l)
                
                new_lookups.sort()
                
                if new_lookups != list(record.Feature.LookupListIndex):
                    record.Feature.LookupListIndex[:] = new_lookups
                    changes += len(lookups_to_add) + len(lookups_to_remove)
                    injected.add(record.FeatureTag)
                    
        return changes, list(injected)

    gsub_changes, gsub_injected = process_table('GSUB', ['rlig', 'rclt', 'calt', 'liga'])
    gpos_changes, gpos_injected = process_table('GPOS', ['kern', 'dist', 'mark', 'mkmk', 'curs'])
    
    if gsub_changes == 0 and gpos_changes == 0 and (features_to_add or features_to_unfreeze):
        return {"success": False, "error": "No target mandatory features found in font to apply modifications"}
        
    # Handle font name table based on action
    name_changes = []
    if 'name' in font:
        name_table = font['name']
        for record in name_table.names:
            if record.nameID in (1, 3, 4, 6, 16):
                try:
                    old_name = record.toUnicode()
                    new_name = old_name
                    
                    if action == 'unfreeze':
                        new_name = re.sub(r'[\\s\\-]?[Mm][Oo][Bb]$', '', old_name)
                        new_name = re.sub(r'[\\s\\-]?[Mm][Oo][Bb]([\\s\\-])', r'\\1', new_name)
                    elif action == 'freeze' or action == 'mixed':
                        if " mob" not in old_name.lower() and "-mob" not in old_name.lower():
                            suffix = "-mob" if record.nameID == 6 else " mob"
                            new_name = old_name + suffix
                    
                    if new_name != old_name:
                        if record.platformID == 3:
                            record.string = new_name.encode('utf_16_be')
                        elif record.platformID == 1:
                            record.string = new_name.encode('mac_roman', errors='ignore')
                        else:
                            record.string = new_name.encode('utf-8', errors='ignore')
                            
                        name_changes.append(f"ID {record.nameID}")
                except Exception:
                    pass

    out = BytesIO()
    font.save(out)
    return {
        "success": True,
        "lookups_count": gsub_changes + gpos_changes,
        "injected_into": gsub_injected + gpos_injected,
        "source_features": list(features_to_freeze),
        "name_changes": name_changes,
        "action": action,
        "bytes": out.getvalue()
    }
`;

export const initPyodide = async (): Promise<void> => {
  if (pyodide) return;

  if (!(window as any).loadPyodide) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Pyodide script'));
      document.head.appendChild(script);
    });
  }

  pyodide = await (window as any).loadPyodide();
  await pyodide.loadPackage('micropip');
  const micropip = pyodide.pyimport('micropip');
  await micropip.install('fonttools');
  await pyodide.runPythonAsync(pythonScript);
};

export const getFontFeatures = async (
  buffer: ArrayBuffer
): Promise<{ error?: string; features: string[]; frozenFeatures: string[] }> => {
  try {
    const fontBytes = new Uint8Array(buffer);
    pyodide.globals.set('font_bytes', fontBytes);
    await pyodide.runPythonAsync(`info = get_features_py(bytes(font_bytes))`);
    const info = pyodide.globals.get('info').toJs({ dict_converter: Object.fromEntries });
    return { features: info.available, frozenFeatures: info.frozen };
  } catch (error: any) {
    return { error: error.message, features: [], frozenFeatures: [] };
  }
};

export const processFont = async (
  buffer: ArrayBuffer,
  selectedFeatures: string[]
): Promise<{ result: FreezeResult; bytes?: Uint8Array }> => {
  try {
    const fontBytes = new Uint8Array(buffer);
    pyodide.globals.set('font_bytes', fontBytes);
    pyodide.globals.set('selected_features', selectedFeatures);
    await pyodide.runPythonAsync(`
py_features = selected_features.to_py() if hasattr(selected_features, 'to_py') else list(selected_features)
result_dict = freeze_features_py(bytes(font_bytes), py_features)
    `);

    const resultDict = pyodide.globals.get('result_dict').toJs({ dict_converter: Object.fromEntries });

    const result: FreezeResult = {
      success: resultDict.success,
      error: resultDict.error,
      lookups_count: resultDict.lookups_count,
      injected_into: resultDict.injected_into,
      source_features: resultDict.source_features,
      name_changes: resultDict.name_changes,
      action: resultDict.action,
    };

    let bytes: Uint8Array | undefined;
    if (result.success && resultDict.bytes) {
      bytes = new Uint8Array(resultDict.bytes);
    }

    return { result, bytes };
  } catch (error: any) {
    return { result: { success: false, error: error.message } };
  }
};
