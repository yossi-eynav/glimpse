import type { IntervalSubmitResult, IntervalUnit } from '../../shared/ipc-types.ts';

type CustomIntervalApi = {
  getCurrent(): Promise<{ minutes: number }>;
  submit(value: number, unit: IntervalUnit): Promise<IntervalSubmitResult>;
  cancel(): Promise<void>;
};

declare global {
  interface Window {
    customInterval: CustomIntervalApi;
  }
}

const api = window.customInterval;
const value = document.getElementById('value') as HTMLInputElement;
const unit = document.getElementById('unit') as HTMLSelectElement;
const hint = document.getElementById('hint') as HTMLParagraphElement;
const ok = document.getElementById('ok') as HTMLButtonElement;

const PER_UNIT: Record<IntervalUnit, number> = { minutes: 1, hours: 60, days: 1440 };

function validate(): void {
  const v = Number(value.value);
  const minutes = v * PER_UNIT[unit.value as IntervalUnit];
  const valid = Number.isInteger(v) && minutes >= 1 && minutes <= 10_080;
  ok.disabled = !valid;
  hint.classList.toggle('invalid', !valid);
}

const { minutes } = await api.getCurrent();
if (minutes % 1440 === 0) [value.value, unit.value] = [String(minutes / 1440), 'days'];
else if (minutes % 60 === 0) [value.value, unit.value] = [String(minutes / 60), 'hours'];
else [value.value, unit.value] = [String(minutes), 'minutes'];
validate();
value.select();

value.addEventListener('input', validate);
unit.addEventListener('change', validate);
document.getElementById('cancel')?.addEventListener('click', () => void api.cancel());
document.getElementById('form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await api.submit(Number(value.value), unit.value as IntervalUnit);
  if (!result.ok) {
    hint.textContent = result.hint;
    hint.classList.add('invalid');
  }
});
