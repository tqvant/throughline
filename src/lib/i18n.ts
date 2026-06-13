// Lightweight i18n. The high-value translation is the generated CONTENT (plans,
// resources, call scripts, application drafts) — produced in the user's language
// by the model (see `languageName`). This file also localizes the core UI chrome
// for California's most common threshold languages.
//
// Translations are AI-assisted; the deterministic facts (FPL math, program
// rules) are language-independent.

export interface Language {
  code: string;
  /** Shown in the picker, in the language itself. */
  label: string;
  /** Used in the model prompt, e.g. "Spanish". */
  name: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', name: 'English' },
  { code: 'es', label: 'Español', name: 'Spanish' },
  { code: 'zh', label: '中文', name: 'Chinese (Simplified)' },
  { code: 'vi', label: 'Tiếng Việt', name: 'Vietnamese' },
  { code: 'tl', label: 'Tagalog', name: 'Tagalog' },
];

export function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? 'English';
}

export type StringKey =
  | 'heroTitle'
  | 'lede'
  | 'trustFree'
  | 'trustData'
  | 'trustStored'
  | 'discNote'
  | 'tabPlan'
  | 'tabNow'
  | 'btnPlan'
  | 'btnNow'
  | 'clear'
  | 'situation'
  | 'gap'
  | 'where'
  | 'need'
  | 'else'
  | 'lang';

type Dict = Record<StringKey, string>;

const en: Dict = {
  heroTitle: "Lost your job? Don't lose care too.",
  lede:
    'We find the free and low-cost coverage you qualify for, the care you can get right now, and we draft the paperwork — so you can focus on what comes next.',
  trustFree: 'Free to use',
  trustData: 'Built on public data + the live web',
  trustStored: 'Nothing stored',
  discNote:
    'Throughline helps you find benefits and care. It is not medical advice and does not diagnose or treat any condition.',
  tabPlan: 'Plan my coverage',
  tabNow: 'Find care now',
  btnPlan: 'Find my coverage',
  btnNow: 'Find care near me now',
  clear: 'Clear',
  situation: 'Your situation',
  gap: 'The gap before coverage kicks in',
  where: 'Where are you?',
  need: 'What do you need?',
  else: 'Anything else? (optional)',
  lang: 'Language',
};

const es: Dict = {
  heroTitle: '¿Perdiste tu empleo? No pierdas también tu atención médica.',
  lede:
    'Encontramos la cobertura gratuita o de bajo costo para la que califica, la atención que puede recibir ahora mismo, y preparamos los trámites — para que pueda concentrarse en lo que sigue.',
  trustFree: 'Gratis',
  trustData: 'Basado en datos públicos + la web',
  trustStored: 'No guardamos nada',
  discNote:
    'Throughline le ayuda a encontrar beneficios y atención. No es consejo médico y no diagnostica ni trata ninguna condición.',
  tabPlan: 'Planear mi cobertura',
  tabNow: 'Buscar atención ahora',
  btnPlan: 'Buscar mi cobertura',
  btnNow: 'Buscar atención cerca de mí',
  clear: 'Borrar',
  situation: 'Su situación',
  gap: 'El periodo sin cobertura',
  where: '¿Dónde se encuentra?',
  need: '¿Qué necesita?',
  else: '¿Algo más? (opcional)',
  lang: 'Idioma',
};

const zh: Dict = {
  heroTitle: '失业了？也别失去医疗保障。',
  lede:
    '我们帮您找到符合条件的免费或低价保险、现在就能获得的医疗服务，并为您起草申请材料——让您专注于接下来的事。',
  trustFree: '免费使用',
  trustData: '基于公开数据和实时网络',
  trustStored: '不保存任何信息',
  discNote: 'Throughline 帮助您寻找福利和医疗资源。这不是医疗建议，也不诊断或治疗任何疾病。',
  tabPlan: '规划我的保险',
  tabNow: '立即寻找医疗',
  btnPlan: '查找我的保险',
  btnNow: '查找我附近的医疗',
  clear: '清除',
  situation: '您的情况',
  gap: '保险生效前的空档期',
  where: '您在哪里？',
  need: '您需要什么？',
  else: '还有其他信息吗？（可选）',
  lang: '语言',
};

const vi: Dict = {
  heroTitle: 'Mất việc? Đừng mất luôn việc chăm sóc sức khỏe.',
  lede:
    'Chúng tôi tìm bảo hiểm miễn phí hoặc chi phí thấp mà bạn đủ điều kiện, dịch vụ bạn có thể nhận ngay bây giờ, và soạn sẵn giấy tờ — để bạn tập trung vào việc kế tiếp.',
  trustFree: 'Miễn phí',
  trustData: 'Dựa trên dữ liệu công khai + web',
  trustStored: 'Không lưu trữ gì',
  discNote:
    'Throughline giúp bạn tìm trợ cấp và dịch vụ chăm sóc. Đây không phải là lời khuyên y tế và không chẩn đoán hay điều trị bất kỳ bệnh nào.',
  tabPlan: 'Lập kế hoạch bảo hiểm',
  tabNow: 'Tìm chăm sóc ngay',
  btnPlan: 'Tìm bảo hiểm của tôi',
  btnNow: 'Tìm chăm sóc gần tôi',
  clear: 'Xóa',
  situation: 'Tình huống của bạn',
  gap: 'Khoảng trống trước khi bảo hiểm bắt đầu',
  where: 'Bạn ở đâu?',
  need: 'Bạn cần gì?',
  else: 'Còn gì khác không? (tùy chọn)',
  lang: 'Ngôn ngữ',
};

const tl: Dict = {
  heroTitle: 'Nawalan ng trabaho? Huwag mawalan din ng pangangalaga.',
  lede:
    'Hinahanap namin ang libre o murang coverage na kuwalipikado ka, ang pangangalagang makukuha mo ngayon, at inihahanda namin ang mga papeles — para makapag-focus ka sa susunod.',
  trustFree: 'Libreng gamitin',
  trustData: 'Batay sa pampublikong datos + web',
  trustStored: 'Walang itinatago',
  discNote:
    'Tumutulong ang Throughline na makahanap ng benepisyo at pangangalaga. Hindi ito medikal na payo at hindi nagdidiyagnosa o gumagamot ng anumang kondisyon.',
  tabPlan: 'Planuhin ang aking coverage',
  tabNow: 'Maghanap ng pangangalaga ngayon',
  btnPlan: 'Hanapin ang aking coverage',
  btnNow: 'Maghanap ng pangangalaga malapit sa akin',
  clear: 'I-clear',
  situation: 'Ang iyong sitwasyon',
  gap: 'Ang puwang bago magsimula ang coverage',
  where: 'Nasaan ka?',
  need: 'Ano ang kailangan mo?',
  else: 'May iba pa ba? (opsyonal)',
  lang: 'Wika',
};

const DICTS: Record<string, Dict> = { en, es, zh, vi, tl };

export function t(lang: string, key: StringKey): string {
  return (DICTS[lang] ?? en)[key] ?? en[key];
}
