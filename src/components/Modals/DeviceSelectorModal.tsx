import React from 'react';
import { X, Radio, Laptop, Check, Volume2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface DeviceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: string;
  onSelectDevice: (deviceName: string) => void;
}

const BROWSER_DEVICE_NAME = 'Web Player (This Browser)';

export const DeviceSelectorModal: React.FC<DeviceSelectorModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  onSelectDevice,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  const isSelected = activeDevice === BROWSER_DEVICE_NAME;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 text-white select-none sm:items-center sm:p-4">
      <div className="relative w-full max-w-md rounded-t-[2rem] border border-white/10 bg-[#181818] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in fade-in zoom-in duration-200 sm:rounded-2xl sm:p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 flex items-center gap-3 pr-10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#A855F7]/40 bg-[#A855F7]/20 text-[#C084FC]">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-white tracking-tight">{t('Audio Output')}</h3>
            <p className="text-xs text-zinc-400">{t('Only outputs actually controlled by this app are shown')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectDevice(BROWSER_DEVICE_NAME)}
          className={`flex w-full min-w-0 items-center justify-between rounded-xl border p-3 text-left transition-all sm:p-3.5 ${
            isSelected
              ? 'bg-[#A855F7]/15 border-[#A855F7]/40 text-white shadow-md'
              : 'bg-[#242424]/60 border-white/5 hover:bg-[#282828] text-zinc-300'
          }`}
        >
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
                <span className="min-w-0 truncate">{t(BROWSER_DEVICE_NAME)}</span>
                {isSelected && (
                  <span className="shrink-0 rounded border border-[#A855F7]/30 bg-[#A855F7]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#C084FC]">
                    {t('Active')}
                  </span>
                )}
              </h4>
              <p className="text-xs text-zinc-400 truncate">{t('Uses the output selected by your browser or operating system')}</p>
            </div>
          </div>
          {isSelected && <Check className="w-5 h-5 text-[#D946EF] flex-shrink-0 ml-2" />}
        </button>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-4 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex min-w-0 items-start gap-2 leading-5 sm:items-center">
            <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D946EF] sm:mt-0" />
            <span>{t('Change physical output in system sound settings')}</span>
          </span>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-white/10 px-4 py-2.5 font-bold text-white transition-all hover:bg-white/20 sm:w-auto sm:rounded-full sm:py-1.5"
          >
            {t('Done')}
          </button>
        </div>
      </div>
    </div>
  );
};
