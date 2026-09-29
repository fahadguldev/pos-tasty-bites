import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  applyBackfill,
  createContact,
  deleteContact,
  getAdminContacts,
  previewBackfill,
  updateContact,
} from '../../lib/apiClient';
import { money } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { BackfillPreview, Contact, ContactList } from '../../lib/types';
import { Badge, EmptyState, ErrorNote, Field, Loading, Modal, Stat } from '../../components/ui';
import { CloseIcon, PhoneIcon, PlusIcon, SearchIcon, SparkIcon, TrashIcon } from '../../components/ui/Icons';

const FILTERS = [
  { key: '', label: 'Everyone' },
  { key: 'contactable', label: 'Can be messaged' },
  { key: 'optedOut', label: 'Opted out' },
];

const blank = (): Contact => ({
  _id: '',
  name: '',
  phone: '',
  area: '',
  notes: '',
  source: 'manual',
  consentSource: '',
  consentedAt: null,
  optOut: false,
  optedOutAt: null,
  doNotContactUntil: null,
  qualifiedAt: null,
  tags: [],
  orderCount: 0,
  firstOrderAt: null,
  lastOrderAt: null,
  totalSpent: 0,
  lastKnownAddress: '',
  lastKnownArea: '',
  isContactable: true,
  createdAt: '',
});

export default function AdminContacts() {
  const [data, setData] = useState<ContactList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [backfill, setBackfill] = useState<BackfillPreview | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setData(await getAdminContacts({ q: search || undefined, filter: filter || undefined }));
        setError('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [search, filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const save = async (contact: Contact) => {
    const body = {
      name: contact.name,
      phone: contact.phone,
      area: contact.area,
      notes: contact.notes,
      consentSource: contact.consentSource,
    };

    try {
      if (contact._id) {
        await updateContact(contact._id, body);
        toast.success('Contact saved');
      } else {
        await createContact(body);
        toast.success('Contact added');
      }
      setEditing(null);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setOptOut = async (contact: Contact, optOut: boolean) => {
    const what = optOut ? 'stop messaging' : 'start messaging again';
    if (optOut && !confirm(`Stop messaging ${contact.name}? This cannot be undone from here.`)) return;
    try {
      await updateContact(contact._id, { optOut });
      toast.success(`${contact.name} will ${what}`);
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (contact: Contact) => {
    if (!confirm(`Delete ${contact.name} from the contact list? Their orders are not affected.`)) return;
    try {
      await deleteContact(contact._id);
      toast.success('Contact deleted');
      load(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading && !data) return <Loading label="Loading contacts…" />;

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Customers</h1>
          <p className="text-sm text-ink-500">
            Only people who already ordered from us. This is the list campaigns can message.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-outline"
            onClick={async () => {
              try {
                setBackfill(await previewBackfill());
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <SparkIcon className="h-4 w-4" /> Build from orders
          </button>
          <button className="btn-primary" onClick={() => setEditing(blank())}>
            <PlusIcon className="h-4 w-4" /> Add customer
          </button>
        </div>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="On the list" value={summary.total} />
          <Stat label="Can be messaged" value={summary.contactable} tone="positive" />
          <Stat label="Asked to stop" value={summary.optedOut} tone="negative" />
          <Stat label="Paused for now" value={summary.snoozed} tone="brand" sub='tapped "not now"' />
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, number or area"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key || 'all'}
                className={filter === f.key ? 'btn-dark btn-sm' : 'btn-ghost btn-sm'}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!data || data.contacts.length === 0 ? (
        <EmptyState
          title={search || filter ? 'Nobody matches that' : 'No customers yet'}
          hint={
            search || filter
              ? 'Try a different search.'
              : 'Use "Build from orders" to add everyone who has already placed an order.'
          }
          icon={<PhoneIcon className="h-6 w-6" />}
        />
      ) : (
        <div className="card table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs tracking-wide text-ink-500 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Spent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((contact) => (
                <tr key={contact._id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{contact.name}</p>
                    {contact.area && <p className="text-xs text-ink-500">{contact.area}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">+{contact.phone}</td>
                  <td className="px-4 py-3">{contact.orderCount}</td>
                  <td className="px-4 py-3">{money(contact.totalSpent)}</td>
                  <td className="px-4 py-3">
                    <StatusTags contact={contact} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(contact)}>
                        Edit
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setOptOut(contact, !contact.optOut)}
                      >
                        {contact.optOut ? 'Unblock' : 'Stop'}
                      </button>
                      <button
                        className="btn-ghost btn-sm text-berry-600"
                        onClick={() => remove(contact)}
                        aria-label={`Delete ${contact.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ContactEditor
          contact={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {backfill && (
        <BackfillModal
          preview={backfill}
          onClose={() => setBackfill(null)}
          onDone={() => {
            setBackfill(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}

function StatusTags({ contact }: { contact: Contact }) {
  if (contact.optOut) return <Badge tone="berry">asked to stop</Badge>;
  if (contact.doNotContactUntil && new Date(contact.doNotContactUntil) > new Date())
    return <Badge tone="warn">paused until {formatDate(contact.doNotContactUntil)}</Badge>;
  if (contact.qualifiedAt) return <Badge tone="success">asked for a deal</Badge>;
  return <Badge tone="muted">can be messaged</Badge>;
}

function ContactEditor({
  contact,
  onClose,
  onSave,
}: {
  contact: Contact;
  onClose: () => void;
  onSave: (c: Contact) => void;
}) {
  const [draft, setDraft] = useState(contact);
  const set = <K extends keyof Contact>(key: K, value: Contact[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Modal open onClose={onClose} title={contact._id ? `Edit ${contact.name}` : 'Add a customer'}>
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <Field
          label="WhatsApp number"
          hint="Pakistani mobile numbers only. 0300… and +92300… both work."
        >
          <input
            className="input"
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="0300 1234567"
            inputMode="tel"
          />
        </Field>

        <Field label="Area" hint="Helps you judge who is nearby.">
          <input className="input" value={draft.area} onChange={(e) => set('area', e.target.value)} />
        </Field>

        <Field label="Notes" hint="Anything you want to remember. Staff only.">
          <textarea
            className="input min-h-20"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        {contact._id && contact.source === 'order' && (
          <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
            Added from {contact.orderCount} order{contact.orderCount === 1 ? '' : 's'} · last ordered{' '}
            {contact.lastOrderAt ? formatDate(contact.lastOrderAt) : 'unknown'}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-ghost" onClick={onClose}>
            <CloseIcon className="h-4 w-4" /> Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim() || !draft.phone.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Importing is two-step and never automatic. The admin sees the exact numbers
 * that would be added, and the ones being left out with the reason, before
 * anything is written.
 */
function BackfillModal({
  preview,
  onClose,
  onDone,
}: {
  preview: BackfillPreview;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await applyBackfill();
      toast.success(`${result.created} added, ${result.updated} updated`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open wide onClose={onClose} title="Build the list from real orders">
      <div className="space-y-5">
        <p className="text-sm text-ink-600">
          Scanned {preview.scannedOrders} orders. {preview.existingContacts} of these people are already on the list.
        </p>

        <Group title={`Would add (${preview.toCreate.length})`} empty="Nobody new.">
          {preview.toCreate.map((c) => (
            <li key={c.phone} className="flex justify-between gap-3 py-1 text-sm">
              <span>
                {c.name} <span className="font-mono text-xs text-ink-500">+{c.phone}</span>
              </span>
              <span className="text-xs text-ink-500">{c.orderCount} orders</span>
            </li>
          ))}
        </Group>

        <Group title={`Would refresh (${preview.toUpdate.length})`} empty="None.">
          {preview.toUpdate.map((phone) => (
            <li key={phone} className="py-1 font-mono text-xs">
              +{phone}
            </li>
          ))}
        </Group>

        <Group title={`Left out (${preview.skipped.length})`} empty="None.">
          {preview.skipped.map((c) => (
            <li key={c.phone} className="flex justify-between gap-3 py-1 text-sm">
              <span>
                {c.name} <span className="font-mono text-xs text-ink-500">+{c.phone}</span>
              </span>
              <span className="text-xs text-ink-500">{c.reason}</span>
            </li>
          ))}
        </Group>

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={run} disabled={busy}>
            {preview.toCreate.length + preview.toUpdate.length === 0
              ? 'Nothing to do'
              : `Add ${preview.toCreate.length} customer${preview.toCreate.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Group({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.flat() : [children];
  const isEmpty = items.length === 0 || (items.length === 1 && items[0] === null);

  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      {isEmpty ? (
        <p className="mt-1 text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-1 max-h-48 divide-y divide-ink-100 overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}
