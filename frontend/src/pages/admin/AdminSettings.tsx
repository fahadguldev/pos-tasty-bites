import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { money } from '../../lib/api';
import { changePassword, getAdminSettings, getUploadStatus, saveAdminSettings } from '../../lib/apiClient';
import type { PaymentAccount, PaymentMethod, Settings } from '../../lib/types';
import { useAdmin } from '../../store/admin';
import { Badge, ErrorNote, Field, Spinner } from '../../components/ui';
import { CheckIcon, WhatsAppIcon } from '../../components/ui/Icons';

const ALL_METHODS: { code: PaymentMethod; label: string }[] = [
  { code: 'cod', label: 'Cash on delivery' },
  { code: 'jazzcash', label: 'JazzCash' },
  { code: 'easypaisa', label: 'Easypaisa' },
  { code: 'bank', label: 'Bank transfer' },
  { code: 'card', label: 'Card on delivery' },
  { code: 'other', label: 'Other' },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadOn, setUploadOn] = useState<boolean | null>(null);
  const user = useAdmin((s) => s.user);

  useEffect(() => {
    getAdminSettings()
      .then(setSettings)
      .catch((e) => setError((e as Error).message));
    getUploadStatus()
      .then((s) => setUploadOn(s.cloudinary))
      .catch(() => setUploadOn(false));
  }, []);

  if (error && !settings) return <ErrorNote>{error}</ErrorNote>;
  if (!settings) return <Spinner className="mx-auto mt-16 h-6 w-6 text-brand-600" />;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const setSocial = (key: 'facebook' | 'instagram' | 'tiktok', value: string) =>
    setSettings((s) => (s ? { ...s, social: { ...s.social, [key]: value } } : s));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      setSettings(await saveAdminSettings(settings));
      toast.success('Settings saved');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const activeCount = settings.paymentMethods.filter((m) => m.active !== false).length;

  const toggleMethod = (code: PaymentMethod) => {
    const existing = settings.paymentMethods.find((m) => m.code === code);
    const base = ALL_METHODS.find((m) => m.code === code)!;
    const isOn = !!existing && existing.active !== false;

    if (isOn) {
      if (activeCount <= 1) {
        toast.error('Keep at least one payment method switched on.');
        return;
      }
      // keep it in the list but hide it from checkout
      set(
        'paymentMethods',
        settings.paymentMethods.map((m) => (m.code === code ? { ...m, active: false } : m)),
      );
      return;
    }

    set(
      'paymentMethods',
      existing
        ? settings.paymentMethods.map((m) => (m.code === code ? { ...m, active: true } : m))
        : [
            ...settings.paymentMethods,
            {
              code,
              label: base.label,
              accountTitle: '',
              accountNumber: '',
              instructions: '',
              sortOrder: settings.paymentMethods.length,
              active: true,
            } satisfies PaymentAccount,
          ],
    );
  };

  const updateMethod = (code: PaymentMethod, patch: Partial<PaymentAccount>) =>
    set(
      'paymentMethods',
      settings.paymentMethods.map((m) => (m.code === code ? { ...m, ...patch } : m)),
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-28">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Shop details, delivery rules and payment accounts.</p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="card p-6">
        <h2 className="font-semibold">Shop</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Shop name">
            <input className="input" value={settings.shopName} onChange={(e) => set('shopName', e.target.value)} />
          </Field>
          <Field label="Tagline">
            <input className="input" value={settings.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Public phone">
            <input
              className="input"
              value={settings.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="03001234567"
            />
          </Field>
          <Field label="WhatsApp number" hint="Country code, digits only. No + or spaces.">
            <input
              className="input"
              value={settings.whatsappNumber}
              onChange={(e) => set('whatsappNumber', e.target.value.replace(/\D/g, ''))}
              placeholder="923001234567"
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Address">
            <input className="input" value={settings.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="City">
            <input className="input" value={settings.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="About text" hint="Shown on the About page.">
            <textarea
              className="input min-h-24 resize-y"
              value={settings.about || ''}
              onChange={(e) => set('about', e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Logo URL" hint="Optional — shown in the header.">
            <input className="input" value={settings.logo || ''} onChange={(e) => set('logo', e.target.value)} />
          </Field>
          <Field label="Cover image URL" hint="Optional — homepage banner.">
            <input
              className="input"
              value={settings.coverImage || ''}
              onChange={(e) => set('coverImage', e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Delivery</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Delivery fee (Rs)">
            <input
              className="input"
              type="number"
              min={0}
              value={settings.deliveryFee}
              onChange={(e) => set('deliveryFee', Number(e.target.value))}
            />
          </Field>
          <Field label="Free delivery over (Rs)" hint="0 turns free delivery off.">
            <input
              className="input"
              type="number"
              min={0}
              value={settings.freeDeliveryAbove}
              onChange={(e) => set('freeDeliveryAbove', Number(e.target.value))}
            />
          </Field>
          <Field label="Minimum order (Rs)">
            <input
              className="input"
              type="number"
              min={0}
              value={settings.minOrderValue}
              onChange={(e) => set('minOrderValue', Number(e.target.value))}
            />
          </Field>
          <Field label="Estimated delivery (minutes)">
            <input
              className="input"
              type="number"
              min={0}
              value={settings.estimatedDeliveryMinutes}
              onChange={(e) => set('estimatedDeliveryMinutes', Number(e.target.value))}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          A {money(settings.minOrderValue)} order pays {money(settings.deliveryFee)} delivery
          {settings.freeDeliveryAbove > 0 && (
            <>
              , and orders above {money(settings.freeDeliveryAbove)} ship free. A {money(500)} order would{' '}
              {500 >= settings.freeDeliveryAbove ? 'ship free' : `pay ${money(settings.deliveryFee)}`}.
            </>
          )}
          .
        </p>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Payment methods</h2>
        <p className="mt-1 text-sm text-ink-500">
          Customers pick one of these on checkout. Transfer details are shown to them for anything that is not
          cash.
        </p>

        <div className="mt-4 space-y-3">
          {ALL_METHODS.map((base) => {
            const m = settings.paymentMethods.find((x) => x.code === base.code);
            const on = !!m && m.active !== false;
            return (
              <div key={base.code} className="rounded-xl border border-ink-200 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={on}
                    onChange={() => toggleMethod(base.code)}
                  />
                  <span className="font-semibold">{m?.label || base.label}</span>
                  {on ? <Badge tone="success">On</Badge> : <Badge tone="muted">Off</Badge>}
                </label>

                {on && (
                  <div className="mt-3 space-y-3">
                    {base.code !== 'cod' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Account title">
                          <input
                            className="input"
                            value={m?.accountTitle || ''}
                            onChange={(e) => updateMethod(base.code, { accountTitle: e.target.value })}
                            placeholder="Tasty Bites"
                          />
                        </Field>
                        <Field label="Account number / ID">
                          <input
                            className="input"
                            value={m?.accountNumber || ''}
                            onChange={(e) => updateMethod(base.code, { accountNumber: e.target.value })}
                            placeholder="03001234567"
                          />
                        </Field>
                      </div>
                    )}
                    <Field label="Instructions for customers" hint="Optional, shown under the payment option.">
                      <input
                        className="input"
                        value={m?.instructions || ''}
                        onChange={(e) => updateMethod(base.code, { instructions: e.target.value })}
                        placeholder="Send the amount and share the transaction ID."
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Social links</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Facebook">
            <input
              className="input"
              value={settings.social?.facebook || ''}
              onChange={(e) => setSocial('facebook', e.target.value)}
              placeholder="https://facebook.com/…"
            />
          </Field>
          <Field label="Instagram">
            <input
              className="input"
              value={settings.social?.instagram || ''}
              onChange={(e) => setSocial('instagram', e.target.value)}
              placeholder="https://instagram.com/…"
            />
          </Field>
          <Field label="TikTok">
            <input
              className="input"
              value={settings.social?.tiktok || ''}
              onChange={(e) => setSocial('tiktok', e.target.value)}
              placeholder="https://tiktok.com/@…"
            />
          </Field>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Take orders</h2>
            <p className="mt-1 text-sm text-ink-500">Turn this off to pause the shop — the website stops taking orders.</p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-600"
              checked={settings.acceptingOrders !== false}
              onChange={(e) => set('acceptingOrders', e.target.checked)}
            />
            <span className="text-sm font-semibold">{settings.acceptingOrders !== false ? 'Open' : 'Paused'}</span>
          </label>
        </div>

        <div className="mt-4">
          <Field label="Notice for customers" hint="Shown as a banner when the shop is paused, e.g. 'Closed for Eid'.">
            <input
              className="input"
              value={settings.closedNotice || ''}
              onChange={(e) => set('closedNotice', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {uploadOn === false && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Photo uploads are off because Cloudinary is not configured. Add the Cloudinary keys to the backend{' '}
          <code className="font-mono text-xs">.env</code> to enable them — pasting image URLs works in the meantime.
        </p>
      )}

      <section className="card p-6">
        <h2 className="font-semibold">Your account</h2>
        <div className="mt-3 space-y-1 text-sm">
          <p>
            <span className="text-ink-500">Name:</span> {user?.name}
          </p>
          <p>
            <span className="text-ink-500">Email:</span> {user?.email}
          </p>
          <p>
            <span className="text-ink-500">Role:</span> {user?.role}
          </p>
        </div>

        <ChangePassword />
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-ink-500">
            <WhatsAppIcon className="h-4 w-4 text-emerald-600" /> Orders on WhatsApp land in the same dashboard.
          </span>
          <button className="btn-primary btn-md" onClick={save} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    setBusy(true);
    try {
      await changePassword(current, next);
      toast.success('Password updated');
      setCurrent('');
      setNext('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-ink-200 pt-5">
      <h3 className="text-sm font-semibold">Change password</h3>
      {error && <p className="mt-2 text-xs font-medium text-berry-600">{error}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Current password">
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <button className="btn-outline btn-sm mt-3" onClick={submit} disabled={busy || !current || !next}>
        {busy ? <Spinner className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />} Update password
      </button>
    </div>
  );
}
