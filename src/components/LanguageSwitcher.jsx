import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from './ui/command';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'app_lang';
const ENGLISH = { value: 'en', label: 'English' };

// ponytail: hardcoded instead of read from the widget's auto-populated
// <select> — reading that list required the Google script to fully load
// and initialize first, which is slow/unreliable (ad-blockers, network,
// CSP) and left the dropdown stuck showing only English. Codes are Google
// Translate's standard ISO set, so they stay valid even if the widget is
// briefly slow — only the ACT of translating depends on the live script now.
const INDIAN_LANGUAGES = [
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ur', label: 'Urdu' },
  { value: 'or', label: 'Odia' },
  { value: 'as', label: 'Assamese' },
  { value: 'ne', label: 'Nepali' },
  { value: 'sa', label: 'Sanskrit' },
  { value: 'sd', label: 'Sindhi' },
  { value: 'mai', label: 'Maithili' },
  { value: 'bho', label: 'Bhojpuri' },
  { value: 'mni-Mtei', label: 'Manipuri' },
];

const OTHER_LANGUAGES = [
  { value: 'af', label: 'Afrikaans' }, { value: 'sq', label: 'Albanian' }, { value: 'am', label: 'Amharic' },
  { value: 'ar', label: 'Arabic' }, { value: 'hy', label: 'Armenian' }, { value: 'az', label: 'Azerbaijani' },
  { value: 'eu', label: 'Basque' }, { value: 'be', label: 'Belarusian' }, { value: 'bs', label: 'Bosnian' },
  { value: 'bg', label: 'Bulgarian' }, { value: 'ca', label: 'Catalan' }, { value: 'ceb', label: 'Cebuano' },
  { value: 'ny', label: 'Chichewa' }, { value: 'zh-CN', label: 'Chinese (Simplified)' }, { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'co', label: 'Corsican' }, { value: 'hr', label: 'Croatian' }, { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' }, { value: 'nl', label: 'Dutch' }, { value: 'eo', label: 'Esperanto' },
  { value: 'et', label: 'Estonian' }, { value: 'tl', label: 'Filipino' }, { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' }, { value: 'fy', label: 'Frisian' }, { value: 'gl', label: 'Galician' },
  { value: 'ka', label: 'Georgian' }, { value: 'de', label: 'German' }, { value: 'el', label: 'Greek' },
  { value: 'ht', label: 'Haitian Creole' }, { value: 'ha', label: 'Hausa' }, { value: 'haw', label: 'Hawaiian' },
  { value: 'iw', label: 'Hebrew' }, { value: 'hmn', label: 'Hmong' }, { value: 'hu', label: 'Hungarian' },
  { value: 'is', label: 'Icelandic' }, { value: 'ig', label: 'Igbo' }, { value: 'id', label: 'Indonesian' },
  { value: 'ga', label: 'Irish' }, { value: 'it', label: 'Italian' }, { value: 'ja', label: 'Japanese' },
  { value: 'jw', label: 'Javanese' }, { value: 'kk', label: 'Kazakh' }, { value: 'km', label: 'Khmer' },
  { value: 'rw', label: 'Kinyarwanda' }, { value: 'ko', label: 'Korean' }, { value: 'ku', label: 'Kurdish' },
  { value: 'ky', label: 'Kyrgyz' }, { value: 'lo', label: 'Lao' }, { value: 'la', label: 'Latin' },
  { value: 'lv', label: 'Latvian' }, { value: 'lt', label: 'Lithuanian' }, { value: 'lb', label: 'Luxembourgish' },
  { value: 'mk', label: 'Macedonian' }, { value: 'mg', label: 'Malagasy' }, { value: 'ms', label: 'Malay' },
  { value: 'mt', label: 'Maltese' }, { value: 'mi', label: 'Maori' }, { value: 'mn', label: 'Mongolian' },
  { value: 'my', label: 'Myanmar (Burmese)' }, { value: 'no', label: 'Norwegian' }, { value: 'ps', label: 'Pashto' },
  { value: 'fa', label: 'Persian' }, { value: 'pl', label: 'Polish' }, { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' }, { value: 'ru', label: 'Russian' }, { value: 'sm', label: 'Samoan' },
  { value: 'gd', label: 'Scots Gaelic' }, { value: 'sr', label: 'Serbian' }, { value: 'st', label: 'Sesotho' },
  { value: 'sn', label: 'Shona' }, { value: 'si', label: 'Sinhala' }, { value: 'sk', label: 'Slovak' },
  { value: 'sl', label: 'Slovenian' }, { value: 'so', label: 'Somali' }, { value: 'es', label: 'Spanish' },
  { value: 'su', label: 'Sundanese' }, { value: 'sw', label: 'Swahili' }, { value: 'sv', label: 'Swedish' },
  { value: 'tg', label: 'Tajik' }, { value: 'th', label: 'Thai' }, { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' }, { value: 'uz', label: 'Uzbek' }, { value: 'vi', label: 'Vietnamese' },
  { value: 'cy', label: 'Welsh' }, { value: 'xh', label: 'Xhosa' }, { value: 'yi', label: 'Yiddish' },
  { value: 'yo', label: 'Yoruba' }, { value: 'zu', label: 'Zulu' },
];

const ALL_LANGUAGES = [...INDIAN_LANGUAGES, ...OTHER_LANGUAGES];

function getCombo() {
  return document.querySelector('select.goog-te-combo');
}

function applyLanguage(code) {
  const cookieVal = `/en/${code}`;
  document.cookie = `googtrans=${cookieVal};path=/`;
  document.cookie = `googtrans=${cookieVal};path=/;domain=${window.location.hostname}`;
  const combo = getCombo();
  if (combo) {
    combo.value = code;
    combo.dispatchEvent(new Event('change'));
  } else {
    // Widget hasn't initialized yet — the cookie will be picked up once it does.
    window.location.reload();
  }
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en');
  const initialized = useRef(false);

  useEffect(() => {
    // Banner hiding is CSS-ONLY (see index.css "Page translator" block).
    // Do NOT fight the banner from JS: removing it or churning its styles
    // via MutationObserver/interval breaks Google's translation engine —
    // verified empirically with Playwright (text swap silently stops).
    if (initialized.current) return;
    initialized.current = true;

    if (!document.getElementById('google-translate-script')) {
      window.googleTranslateElementInit = () => {
        // eslint-disable-next-line no-undef
        new window.google.translate.TranslateElement(
          { pageLanguage: 'en', autoDisplay: false },
          'google_translate_element'
        );
      };
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== 'en') {
      const retry = setInterval(() => {
        const combo = getCombo();
        if (combo) {
          combo.value = saved;
          combo.dispatchEvent(new Event('change'));
          clearInterval(retry);
        }
      }, 300);
      setTimeout(() => clearInterval(retry), 8000);
      return () => clearInterval(retry);
    }
  }, []);

  const select = (code) => {
    setCurrent(code);
    localStorage.setItem(STORAGE_KEY, code);
    applyLanguage(code);
    setOpen(false);
  };

  const currentLabel = current === 'en' ? ENGLISH.label : (ALL_LANGUAGES.find((l) => l.value === current)?.label || 'English');

  return (
    <>
      {/* Translator widget mounts its internals here. Must stay rendered (NOT
          display:none) or Google's script fails to initialize — kept
          off-screen instead via the .gt-host class. */}
      <div id="google_translate_element" className="gt-host" aria-hidden="true" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors text-xs font-medium"
            title="Change language"
          >
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline max-w-20 truncate">{currentLabel}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-60" align="end">
          <Command shouldFilter={true}>
            <CommandInput placeholder="Search language…" />
            <CommandList className="max-h-80">
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value={ENGLISH.label} onSelect={() => select(ENGLISH.value)}>
                  <Check className={cn('mr-2 h-3.5 w-3.5', current === ENGLISH.value ? 'opacity-100' : 'opacity-0')} />
                  {ENGLISH.label}
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Indian Languages">
                {INDIAN_LANGUAGES.map((l) => (
                  <CommandItem key={l.value} value={l.label} onSelect={() => select(l.value)}>
                    <Check className={cn('mr-2 h-3.5 w-3.5', current === l.value ? 'opacity-100' : 'opacity-0')} />
                    {l.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="All Languages">
                {OTHER_LANGUAGES.map((l) => (
                  <CommandItem key={l.value} value={l.label} onSelect={() => select(l.value)}>
                    <Check className={cn('mr-2 h-3.5 w-3.5', current === l.value ? 'opacity-100' : 'opacity-0')} />
                    {l.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
