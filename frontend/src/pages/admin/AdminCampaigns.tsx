import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import {
  cancelCampaign,
  createCampaign,
  getAdminCampaigns,
  getWhatsappStatus,
  logoutWhatsapp,
  pauseCampaign,
  previewCampaign,
  resumeCampaign,
  sendWhatsappTest,
  startCampaign,
  updateCampaign,
} from '../../lib/apiClient';
import { money } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type {
  Campaign,
  CampaignOption,
  CampaignPreview,
  CampaignStatus,
  OptionAction,
  WhatsappConnection,
} from '../../lib/types';
import { Badge, EmptyState, ErrorNote, Field, Loading, Modal, Stat } from '../../components/ui';
import { CheckIcon, CloseIcon, PlusIcon, SendIcon, SparkIcon, TagIcon, TrashIcon, WhatsAppIcon } from '../../components/ui/Icons';

const STATUS_TONE: Record<CampaignStatus, 'muted' | 'brand' | 'warn' | 'success' | 'berry'> = {
  draft: 'muted',
  scheduled: 'brand',
  running: 'success',
  paused: 'warn',
  completed: 'muted',
  cancelled: 'berry',
};

const CONNECTION_COPY: Record<WhatsappConnection['status'], string> = {
  offline: 'Not connected',
  starting: 'Starting up…',
  awaiting_scan: 'Scan this code in your phone',
  scanning: 'Code scanned, finishing sign-in…',
  ready: 'Connected',
  error: 'Something went wrong',
  stopped: 'Stopped',
};

const DEFAULT_OPENER =
  '{{spin:Hi|Hello|Hey}} {{name}}, we have something tasty for you at {{shop}}. Want the details?';
const DEFAULT_DEAL = 'Here it is: {{deal.name}} for {{deal.price}} — saving {{deal.saving}}. Reply to this message to order.';

const DEFAULT_OPTIONS: CampaignOption[] = [
  { id: 'yes', label: 'Yes, send it', action: 'send_deal', snoozeDays: 30 },
  { id: 'not_now', label: 'Not now', action: 'snooze', snoozeDays: 30 },
  { id: 'stop', label: 'Stop', action: 'stop', snoozeDays: 30 },
];

/** The QR code the phone scans is a plain string, so it has to be drawn. */
function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    if (!value) {
      setSrc('');
      return;
    }
    QRCode.toDataURL(value, { width: 220, margin: 1 })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (!src) return null;
  return <img src={src} alt="WhatsApp sign-in QR code" className="h-55 w-55 rounded-lg border border-ink-200" />;
}

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [connection, setConnection] = useState<WhatsappConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [previewing, setPreviewing] = useState<CampaignPreview | null>(null);
  const [starting, setStarting] = useState<Campaign | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [list, status] = await Promise.all([getAdminCampaigns(), getWhatsappStatus()]);
      setCampaigns(list);
      setConnection(status);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // the worker reports its progress on its own schedule, so the connection panel
  // is polled rather than pushed
  useEffect(() => {
    const timer = setInterval(() => {
      getWhatsappStatus()
        .then(setConnection)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const save = async (campaign: Campaign) => {
    setBusy(true);
    try {
      // only the editable fields are sent, so a running campaign's counters and
      // lifecycle are never written back over
      const body = {
        name: campaign.name,
        deal: campaign.deal,
        openerTemplate: campaign.openerTemplate,
        dealTemplate: campaign.dealTemplate,
        options: campaign.options,
        sendImage: campaign.sendImage,
        recipientLimit: campaign.recipientLimit,
        gap: campaign.gap,
      };

      if (campaign._id) await updateCampaign(campaign._id, body);
      else await createCampaign(body);

      toast.success('Campaign saved');
      setEditing(null);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (campaign: Campaign) => {
    try {
      setPreviewing(await previewCampaign(campaign._id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const control = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runTest = async () => {
    if (!testPhone.trim()) return;
    try {
      const result = await sendWhatsappTest(testPhone.trim());
      toast.success(result.note);
      setTestPhone('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const signOut = async () => {
    if (!confirm('Sign out of WhatsApp and delete the saved session? You will have to scan a new QR code.')) return;
    await control(() => logoutWhatsapp(), 'Signing out. The worker does this within a few seconds.');
  };

  if (loading) return <Loading label="Loading campaigns…" />;

  const totals = campaigns.reduce(
    (acc, c) => ({
      recipients: acc.recipients + c.stats.recipients,
      openers: acc.openers + c.stats.openersSent,
      deals: acc.deals + c.stats.dealsSent,
    }),
    { recipients: 0, openers: 0, deals: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">WhatsApp campaigns</h1>
          <p className="text-sm text-ink-500">
            Ask first, send the deal only to people who say yes.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(blankCampaign())}>
          <PlusIcon className="h-4 w-4" /> New campaign
        </button>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      <ConnectionPanel
        connection={connection}
        testPhone={testPhone}
        setTestPhone={setTestPhone}
        onTest={runTest}
        onSignOut={signOut}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="People in campaigns" value={totals.recipients} />
        <Stat label="Questions sent" value={totals.openers} tone="brand" />
        <Stat label="Deals sent" value={totals.deals} tone="positive" />
        <Stat
          label="Live now"
          value={campaigns.filter((c) => c.status === 'running').length}
          tone="brand"
          sub="sending right now"
        />
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          hint="Create one, check what it will say, then choose how many people to message."
          icon={<TagIcon className="h-6 w-6" />}
          action={
            <button className="btn-primary" onClick={() => setEditing(blankCampaign())}>
              <PlusIcon className="h-4 w-4" /> New campaign
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <CampaignRow
              key={campaign._id}
              campaign={campaign}
              onEdit={() => setEditing(campaign)}
              onPreview={() => showPreview(campaign)}
              onStart={() => setStarting(campaign)}
              onPause={() => control(() => pauseCampaign(campaign._id), 'Paused')}
              onResume={() => control(() => resumeCampaign(campaign._id), 'Running again')}
              onCancel={() => {
                if (confirm(`Cancel "${campaign.name}"? Nothing further will be sent.`))
                  control(() => cancelCampaign(campaign._id, 'cancelled from the admin panel'), 'Cancelled');
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <CampaignEditor
          campaign={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={save}
          onPreview={showPreview}
        />
      )}

      {previewing && <PreviewModal preview={previewing} onClose={() => setPreviewing(null)} />}

      {starting && (
        <StartModal
          campaign={starting}
          onClose={() => setStarting(null)}
          onConfirm={async (limit) => {
            try {
              const result = await startCampaign(starting._id, limit);
              toast.success(`${result.queued} message${result.queued === 1 ? '' : 's'} queued`);
              setStarting(null);
              load(true);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function blankCampaign(): Campaign {
  return {
    _id: '',
    name: '',
    deal: null,
    openerTemplate: DEFAULT_OPENER,
    dealTemplate: DEFAULT_DEAL,
    options: DEFAULT_OPTIONS,
    sendImage: true,
    recipientLimit: 10,
    gap: { minSeconds: 120, maxSeconds: 300 },
    status: 'draft',
    startedAt: null,
    completedAt: null,
    pausedAt: null,
    cancelReason: '',
    stats: { recipients: 0, openersSent: 0, qualified: 0, dealsSent: 0, snoozed: 0, optedOut: 0, failed: 0 },
    replyRate: null,
    isActive: false,
    createdAt: '',
    updatedAt: '',
  };
}

function ConnectionPanel({
  connection,
  testPhone,
  setTestPhone,
  onTest,
  onSignOut,
}: {
  connection: WhatsappConnection | null;
  testPhone: string;
  setTestPhone: (v: string) => void;
  onTest: () => void;
  onSignOut: () => void;
}) {
  if (!connection) return null;

  const { status } = connection;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold">WhatsApp connection</h2>
            <Badge tone={status === 'ready' ? 'success' : status === 'error' ? 'berry' : 'muted'}>
              {CONNECTION_COPY[status]}
            </Badge>
          </div>

          {status === 'ready' && connection.number && (
            <p className="mt-2 text-sm text-ink-600">
              Sending as <span className="font-semibold">+{connection.number}</span>
            </p>
          )}

          {status === 'offline' && (
            <div className="mt-2 max-w-md text-sm text-ink-600">
              <p>The worker is not running. In a terminal, from the backend folder:</p>
              <code className="mt-1 block rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-white">
                npm run worker
              </code>
              <p className="mt-2">
                It prints a QR code to scan, and this panel shows the same code.
              </p>
            </div>
          )}

          {status === 'awaiting_scan' && (
            <p className="mt-2 max-w-md text-sm text-ink-600">
              On your phone: open WhatsApp, go to <span className="font-semibold">Linked devices</span>, then{' '}
              <span className="font-semibold">Link a device</span> and scan the code.
            </p>
          )}

          {status === 'error' && connection.lastError && (
            <p className="mt-2 max-w-md text-sm text-berry-600">{connection.lastError}</p>
          )}

          {!connection.sendEnabled && status !== 'offline' && (
            <p className="mt-2 text-sm text-amber-700">
              Sending is switched off. Set <code className="font-mono text-xs">WHATSAPP_SEND_ENABLED=true</code> in
              your .env and restart the worker.
            </p>
          )}
        </div>

        {status === 'awaiting_scan' && connection.qr && (
          <div className="shrink-0">
            <QrImage value={connection.qr} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-ink-200 pt-4">
        <div className="w-full sm:w-64">
          <Field
            label="Send a test message"
            hint="Your own number. This never touches the contact list."
          >
            <input
              className="input"
              placeholder="0300 1234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              inputMode="tel"
            />
          </Field>
        </div>
        <button className="btn-outline" onClick={onTest} disabled={!connection.ready || !testPhone.trim()}>
          <SendIcon className="h-4 w-4" /> Send test
        </button>
        {connection.ready && (
          <button className="btn-ghost" onClick={onSignOut}>
            Sign out
          </button>
        )}

        {connection.lastTest?.at && (
          <p className="w-full text-xs text-ink-500">
            Last test to +{connection.lastTest.phone}:{' '}
            {connection.lastTest.ok ? 'delivered' : `failed — ${connection.lastTest.error}`}
          </p>
        )}
      </div>
    </section>
  );
}

function CampaignRow({
  campaign,
  onEdit,
  onPreview,
  onStart,
  onPause,
  onResume,
  onCancel,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onPreview: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const { stats } = campaign;

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{campaign.name}</h3>
            <Badge tone={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 max-w-xl text-sm text-ink-500">{campaign.openerTemplate}</p>
          <p className="mt-1 text-xs text-ink-500">
            {campaign.recipientLimit === 0
              ? 'Everyone contactable'
              : `Up to ${campaign.recipientLimit} people`}{' '}
            · waits {campaign.gap.minSeconds}–{campaign.gap.maxSeconds}s between messages
            {campaign.startedAt ? ` · started ${formatDate(campaign.startedAt)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={onPreview}>
            Preview
          </button>
          {campaign.status === 'draft' && (
            <>
              <button className="btn-ghost btn-sm" onClick={onEdit}>
                Edit
              </button>
              <button className="btn-primary btn-sm" onClick={onStart}>
                <SendIcon className="h-4 w-4" /> Send
              </button>
            </>
          )}
          {campaign.status === 'running' && (
            <button className="btn-outline btn-sm" onClick={onPause}>
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button className="btn-primary btn-sm" onClick={onResume}>
              Resume
            </button>
          )}
          {['running', 'paused', 'draft'].includes(campaign.status) && (
            <button className="btn-ghost btn-sm text-berry-600" onClick={onCancel}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-200 pt-4 sm:grid-cols-5">
        <Figure label="Chosen" value={stats.recipients} />
        <Figure label="Asked" value={stats.openersSent} />
        <Figure label="Said yes" value={stats.qualified} tone="brand" />
        <Figure label="Deals sent" value={stats.dealsSent} tone="positive" />
        <Figure label="Opted out" value={stats.optedOut} tone="negative" />
      </dl>
    </article>
  );
}

function Figure({ label, value, tone = 'default' }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    default: 'text-ink-900',
    brand: 'text-brand-600',
    positive: 'text-emerald-600',
    negative: 'text-berry-600',
  };
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className={`font-display text-lg font-bold ${tones[tone]}`}>{value}</dd>
    </div>
  );
}

const ACTION_LABEL: Record<OptionAction, string> = {
  send_deal: 'Send the deal',
  snooze: 'Pause for later',
  stop: 'Stop messaging',
};

function CampaignEditor({
  campaign,
  busy,
  onClose,
  onSave,
  onPreview,
}: {
  campaign: Campaign;
  busy: boolean;
  onClose: () => void;
  onSave: (c: Campaign) => void;
  onPreview: (c: Campaign) => void;
}) {
  const [draft, setDraft] = useState<Campaign>(campaign);
  const set = <K extends keyof Campaign>(key: K, value: Campaign[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setOption = (index: number, patch: Partial<CampaignOption>) =>
    setDraft((d) => ({
      ...d,
      options: d.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={campaign._id ? `Edit "${campaign.name}"` : 'New campaign'}
    >
      <div className="space-y-4">
        <Field label="Campaign name" hint="Only staff see this. Customers never do.">
          <input
            className="input"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Friday deals"
          />
        </Field>

        <Field
          label="Step 1 — the question"
          hint="Tokens: {{name}} {{area}} {{shop}} {{spin:Hi|Hey|Hello}}"
        >
          <textarea
            className="input min-h-24"
            value={draft.openerTemplate}
            onChange={(e) => set('openerTemplate', e.target.value)}
          />
        </Field>

        <Field
          label="Step 2 — the deal"
          hint="Sent only after someone taps Yes. Tokens: {{deal.name}} {{deal.price}} {{deal.saving}}"
        >
          <textarea
            className="input min-h-24"
            value={draft.dealTemplate}
            onChange={(e) => set('dealTemplate', e.target.value)}
          />
        </Field>

        <div>
          <span className="label">Buttons on the question</span>
          <p className="mb-2 text-xs text-ink-500">WhatsApp allows three.</p>
          <div className="space-y-2">
            {draft.options.map((option, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  className="input"
                  value={option.label}
                  onChange={(e) => setOption(index, { label: e.target.value })}
                  placeholder="Button text"
                />
                <select
                  className="input"
                  value={option.action}
                  onChange={(e) => setOption(index, { action: e.target.value as OptionAction })}
                >
                  {(Object.keys(ACTION_LABEL) as OptionAction[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-ghost"
                  onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== index) }))}
                  aria-label="Remove button"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {draft.options.length < 3 && (
            <button
              className="btn-ghost btn-sm mt-2"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  options: [...d.options, { id: `option_${d.options.length + 1}`, label: '', action: 'send_deal', snoozeDays: 30 }],
                }))
              }
            >
              <PlusIcon className="h-4 w-4" /> Add a button
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Send to at most" hint="0 means everyone you can contact.">
            <input
              className="input"
              type="number"
              min={0}
              value={draft.recipientLimit}
              onChange={(e) => set('recipientLimit', Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="Wait at least (seconds)">
            <input
              className="input"
              type="number"
              min={0}
              value={draft.gap.minSeconds}
              onChange={(e) =>
                set('gap', { ...draft.gap, minSeconds: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Field>
          <Field label="Wait at most (seconds)">
            <input
              className="input"
              type="number"
              min={0}
              value={draft.gap.maxSeconds}
              onChange={(e) =>
                set('gap', { ...draft.gap, maxSeconds: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.sendImage}
            onChange={(e) => set('sendImage', e.target.checked)}
          />
          Attach the deal photo
        </label>

        <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-ghost" onClick={() => onPreview(draft)} disabled={!draft._id}>
            <SparkIcon className="h-4 w-4" /> Preview
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onSave(draft)} disabled={busy || !draft.name.trim()}>
            <CheckIcon className="h-4 w-4" /> Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewModal({ preview, onClose }: { preview: CampaignPreview; onClose: () => void }) {
  return (
    <Modal open wide onClose={onClose} title="What customers will see">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Figure label="Will message" value={preview.audience.willSend} tone="brand" />
          <Figure label="Wording variants" value={preview.openerVariations} />
          <Figure label="Can contact" value={preview.audience.contactable} />
        </div>

        {preview.audience.reason && <ErrorNote>{preview.audience.reason}</ErrorNote>}

        <Sample title="The question" lines={preview.openerSamples} problems={preview.openerProblems} />
        <Sample title="The deal" lines={preview.dealSamples} problems={preview.dealProblems} />

        {preview.deal && (
          <p className="text-sm text-ink-500">
            Deal: {preview.deal.name} · {money(preview.deal.price)}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Sample({
  title,
  lines,
  problems,
}: {
  title: string;
  lines: { name: string; text: string }[];
  problems: string[];
}) {
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      {problems.length > 0 && (
        <p className="mt-1 text-xs font-medium text-berry-600">{problems.join(', ')}</p>
      )}
      <div className="mt-2 space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="rounded-xl border border-ink-200 bg-ink-50 p-3">
            <p className="text-xs font-semibold text-ink-500">{line.name}</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{line.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The one screen that actually puts a number on the air, so the count is typed
 * out rather than assumed, and the consequence is spelled out.
 */
function StartModal({
  campaign,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  onClose: () => void;
  onConfirm: (limit: number) => void;
}) {
  const [limit, setLimit] = useState(campaign.recipientLimit);

  return (
    <Modal open onClose={onClose} title={`Send "${campaign.name}"`}>
      <div className="space-y-4">
        <Field
          label="How many people should get this?"
          hint={`They get one question each, ${campaign.gap.minSeconds}–${campaign.gap.maxSeconds} seconds apart. Nobody gets the deal unless they tap Yes.`}
        >
          <input
            className="input"
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>

        <p className="text-xs text-ink-500">0 sends to everyone you are allowed to contact.</p>

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onConfirm(limit)}>
            <SendIcon className="h-4 w-4" /> Queue {limit === 0 ? 'everyone' : limit}
          </button>
        </div>
      </div>
    </Modal>
  );
}
