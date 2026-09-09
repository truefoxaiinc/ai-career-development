'use client';

import Link from 'next/link';
import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  KeyRound,
  LockKeyhole,
  Mail,
  Megaphone,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';

import {
  API_BASE,
  api,
} from '@/lib/api';

import type { User } from '@/lib/types';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldError,
  Input,
  PageHeader,
  Panel,
  Skeleton,
} from '@/components/ui';

import { useToast } from '@/components/toast';


/* =========================================================
   HELPERS
   ========================================================= */

const err = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Request failed';


function formatDate(value: unknown) {
  if (!value) return '—';

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}


/* =========================================================
   SHARED SETTINGS NAV
   ========================================================= */

function SettingsNav({
  active,
}: {
  active:
    | 'account'
    | 'notifications'
    | 'privacy';
}) {
  const items = [
    {
      id: 'account',
      label: 'Account',
      href: '/dashboard/settings',
      icon: UserRound,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: '/dashboard/settings/notifications',
      icon: Bell,
    },
    {
      id: 'privacy',
      label: 'Privacy',
      href: '/dashboard/settings/privacy',
      icon: Shield,
    },
  ] as const;

  return (
    <div className="mb-5 overflow-x-auto hide-scrollbar">
      <div className="inline-flex min-w-full items-center gap-1 rounded-[14px] border border-border bg-surface-1/80 p-1.5 shadow-sm backdrop-blur-xl sm:min-w-0">
        {items.map(item => {
          const Icon = item.icon;
          const selected = active === item.id;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-11 font-medium transition ${
                selected
                  ? 'bg-text-primary text-canvas shadow-sm'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              }`}
            >
              <Icon size={13} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}


/* =========================================================
   ACCOUNT SETTINGS
   ========================================================= */

export function AccountSettingsPage() {
  const { push } = useToast();

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () =>
      api.get<{
        user: User;
      }>('/auth/session'),
  });

  const [current, setCurrent] =
    useState('');

  const [next, setNext] =
    useState('');

  const [showCurrent, setShowCurrent] =
    useState(false);

  const [showNext, setShowNext] =
    useState(false);

  const change = useMutation({
    mutationFn: () =>
      api.post(
        '/auth/change-password',
        {
          current_password: current,
          new_password: next,
        },
      ),

    onSuccess: () => {
      setCurrent('');
      setNext('');

      push(
        'Password changed. Other refresh sessions were revoked.',
      );
    },
  });


  const verified =
    Boolean(
      session.data?.user
        .is_email_verified,
    );


  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Account settings"
        description="Manage your identity, sign-in security, notifications, and privacy controls."
      />

      <SettingsNav active="account" />

      {session.isLoading ? (
        <AccountLoading />
      ) : session.error ? (
        <ErrorState
          message={err(session.error)}
        />
      ) : (
        <>
          <section className="career-settings-hero mb-5 overflow-hidden rounded-[22px] border border-indigo-500/15">
            <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
              <div className="relative z-10">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-indigo-300">
                  CareerPilot account
                </div>

                <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em] md:text-28">
                  Keep your account secure and your settings intentional.
                </h2>

                <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
                  Security, notification preferences, and privacy controls all live here without changing your verified career profile.
                </p>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-2">
                <SettingsMiniMetric
                  value={
                    verified
                      ? 'Verified'
                      : 'Pending'
                  }
                  label="email"
                  tone={
                    verified
                      ? 'positive'
                      : 'warning'
                  }
                />

                <SettingsMiniMetric
                  value={
                    session.data?.user
                      .role
                      ? String(
                          session.data.user.role,
                        )
                      : 'User'
                  }
                  label="role"
                  tone="indigo"
                />
              </div>
            </div>
          </section>


          <div className="grid gap-5 lg:grid-cols-2">
            <Panel className="career-account-card overflow-hidden">
              <div className="border-b border-border px-5 py-5 md:px-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[11px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                    <UserRound
                      size={17}
                    />
                  </div>

                  <div>
                    <h2 className="text-15 font-semibold">
                      Account identity
                    </h2>

                    <p className="mt-1 text-[10px] text-text-secondary">
                      Sign-in identity and verification status.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5 md:p-6">
                <AccountDetail
                  label="Email"
                  value={
                    session.data?.user
                      .email || '—'
                  }
                  icon={Mail}
                />

                <AccountDetail
                  label="Role"
                  value={
                    session.data?.user
                      .role || '—'
                  }
                  icon={UserRound}
                />

                <div className="flex items-center justify-between gap-4 rounded-[12px] border border-border bg-surface-2/45 p-4">
                  <div>
                    <div className="text-[10px] text-text-secondary">
                      Email verification
                    </div>

                    <div className="mt-1 text-11 font-medium">
                      {verified
                        ? 'Verified'
                        : 'Verification required'}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-medium ${
                      verified
                        ? 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400'
                        : 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400'
                    }`}
                  >
                    {verified ? (
                      <CheckCircle2
                        size={10}
                      />
                    ) : (
                      <CircleAlert
                        size={10}
                      />
                    )}

                    {verified
                      ? 'Verified'
                      : 'Pending'}
                  </span>
                </div>
              </div>
            </Panel>


            <Panel className="career-password-card overflow-hidden">
              <div className="border-b border-border px-5 py-5 md:px-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[11px] border border-violet-500/15 bg-violet-500/10 text-violet-400">
                    <KeyRound
                      size={17}
                    />
                  </div>

                  <div>
                    <h2 className="text-15 font-semibold">
                      Change password
                    </h2>

                    <p className="mt-1 text-[10px] leading-5 text-text-secondary">
                      Available for local password accounts. Changing your password revokes other refresh sessions.
                    </p>
                  </div>
                </div>
              </div>

              <form
                className="space-y-5 p-5 md:p-6"
                onSubmit={e => {
                  e.preventDefault();
                  change.mutate();
                }}
              >
                <PasswordField
                  label="Current password"
                  value={current}
                  onChange={setCurrent}
                  visible={showCurrent}
                  onToggle={() =>
                    setShowCurrent(
                      value => !value,
                    )
                  }
                  autoComplete="current-password"
                />

                <PasswordField
                  label="New password"
                  value={next}
                  onChange={setNext}
                  visible={showNext}
                  onToggle={() =>
                    setShowNext(
                      value => !value,
                    )
                  }
                  autoComplete="new-password"
                  hint="Minimum 10 characters"
                />

                {change.error && (
                  <FieldError>
                    {err(change.error)}
                  </FieldError>
                )}

                <div className="flex justify-end border-t border-border pt-5">
                  <Button
                    disabled={
                      !current ||
                      next.length < 10 ||
                      change.isPending
                    }
                  >
                    {change.isPending
                      ? 'Changing…'
                      : (
                        <>
                          <LockKeyhole
                            size={14}
                          />
                          Change password
                        </>
                      )}
                  </Button>
                </div>
              </form>
            </Panel>
          </div>


          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SettingsLinkCard
              href="/dashboard/settings/notifications"
              icon={Bell}
              title="Notifications & job alerts"
              description="Choose which product updates, job alerts, and application notifications reach you."
              color="cyan"
            />

            <SettingsLinkCard
              href="/dashboard/settings/privacy"
              icon={Shield}
              title="Data privacy"
              description="Review consent records, retention information, exports, and account deletion controls."
              color="emerald"
            />
          </div>
        </>
      )}
    </>
  );
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

type NSettings = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  job_alerts_enabled: boolean;
  application_updates_enabled: boolean;
  marketing_enabled: boolean;
};

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  channel: string;
  read_at?: string | null;
  created_at: string;
};


export function NotificationsPage() {
  const client =
    useQueryClient();

  const { push } =
    useToast();

  const settings =
    useQuery({
      queryKey: [
        'notifications',
        'settings',
      ],

      queryFn: () =>
        api.get<NSettings>(
          '/notifications/settings',
        ),
    });

  const notifications =
    useQuery({
      queryKey: [
        'notifications',
      ],

      queryFn: () =>
        api.get<
          Notification[]
        >('/notifications'),
    });

  const [form, setForm] =
    useState<NSettings | null>(
      null,
    );

  useEffect(() => {
    if (settings.data) {
      setForm(
        settings.data,
      );
    }
  }, [settings.data]);

  const save =
    useMutation({
      mutationFn: () =>
        api.put<NSettings>(
          '/notifications/settings',
          form,
        ),

      onSuccess: data => {
        client.setQueryData(
          [
            'notifications',
            'settings',
          ],
          data,
        );

        push(
          'Notification settings saved',
        );
      },
    });

  const enabledCount =
    form
      ? Object.values(form).filter(
          Boolean,
        ).length
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Notifications & job alerts"
        description="Control how CareerPilot keeps you informed. Marketing remains opt-in."
      />

      <SettingsNav active="notifications" />

      <section className="career-notifications-hero mb-5 overflow-hidden rounded-[22px] border border-cyan-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-cyan-300">
              Notification control
            </div>

            <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em] md:text-28">
              Get useful updates without unnecessary noise.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              Choose channels and categories independently, including job alerts, application updates, and optional product marketing.
            </p>
          </div>

          <div className="relative z-10">
            <SettingsMiniMetric
              value={
                form
                  ? String(
                      enabledCount,
                    )
                  : '—'
              }
              label="enabled"
              tone="cyan"
            />
          </div>
        </div>
      </section>


      {settings.isLoading ||
      !form ? (
        <NotificationsSettingsLoading />
      ) : settings.error ? (
        <ErrorState
          message={err(
            settings.error,
          )}
        />
      ) : (
        <Panel className="career-notification-settings overflow-hidden">
          <div className="border-b border-border px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-[10px] border border-cyan-500/15 bg-cyan-500/10 text-cyan-400">
                <Bell size={15} />
              </div>

              <div>
                <h2 className="text-14 font-semibold">
                  Notification preferences
                </h2>

                <p className="mt-1 text-[10px] text-text-secondary">
                  Changes apply across your CareerPilot account.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 md:p-6">
            <NotificationToggle
              title="In-app notifications"
              description="Show notifications inside CareerPilot."
              icon={Bell}
              checked={
                form.in_app_enabled
              }
              onChange={value =>
                setForm({
                  ...form,
                  in_app_enabled:
                    value,
                })
              }
            />

            <NotificationToggle
              title="Email notifications"
              description="Allow CareerPilot to send account and workflow emails."
              icon={Mail}
              checked={
                form.email_enabled
              }
              onChange={value =>
                setForm({
                  ...form,
                  email_enabled:
                    value,
                })
              }
            />

            <NotificationToggle
              title="Job alerts"
              description="Receive updates when relevant opportunities are generated."
              icon={Target}
              checked={
                form.job_alerts_enabled
              }
              onChange={value =>
                setForm({
                  ...form,
                  job_alerts_enabled:
                    value,
                })
              }
              accent="indigo"
            />

            <NotificationToggle
              title="Application updates"
              description="Receive status and workflow notifications about tracked applications."
              icon={FileArchive}
              checked={
                form.application_updates_enabled
              }
              onChange={value =>
                setForm({
                  ...form,
                  application_updates_enabled:
                    value,
                })
              }
              accent="emerald"
            />

            <div className="md:col-span-2">
              <NotificationToggle
                title="Product marketing"
                description="Optional product news and promotional updates. This stays opt-in."
                icon={Megaphone}
                checked={
                  form.marketing_enabled
                }
                onChange={value =>
                  setForm({
                    ...form,
                    marketing_enabled:
                      value,
                  })
                }
                accent="violet"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-border bg-surface-2/25 p-4 md:px-6">
            <Button
              onClick={() =>
                save.mutate()
              }
              disabled={
                save.isPending
              }
            >
              {save.isPending
                ? 'Saving…'
                : 'Save settings'}
            </Button>
          </div>
        </Panel>
      )}


      <div className="mb-3 mt-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-18 font-semibold">
            Recent notifications
          </h2>

          <p className="mt-1 text-11 text-text-secondary">
            Job alerts and application updates generated for your account.
          </p>
        </div>

        {notifications.data && (
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[9px] text-text-secondary">
            {
              notifications.data
                .length
            }{' '}
            total
          </span>
        )}
      </div>


      {notifications.isLoading ? (
        <NotificationListLoading />
      ) : notifications.error ? (
        <ErrorState
          message={err(
            notifications.error,
          )}
        />
      ) : !notifications.data
          ?.length ? (
        <EmptyState
          title="No notifications"
          description="Job alerts and application updates will appear here when generated."
        />
      ) : (
        <div className="space-y-3">
          {notifications.data.map(
            notification => (
              <NotificationCard
                key={
                  notification.id
                }
                notification={
                  notification
                }
              />
            ),
          )}
        </div>
      )}
    </>
  );
}


/* =========================================================
   PRIVACY
   ========================================================= */

export function PrivacyPage() {
  const { push } =
    useToast();

  const session =
    useQuery({
      queryKey: [
        'session',
      ],

      queryFn: () =>
        api.get<{
          user: User;
        }>('/auth/session'),
    });

  const consents =
    useQuery({
      queryKey: [
        'privacy',
        'consents',
      ],

      queryFn: () =>
        api.get<
          Array<
            Record<
              string,
              unknown
            >
          >
        >(
          '/privacy/consents',
        ),
    });

  const retention =
    useQuery({
      queryKey: [
        'privacy',
        'retention',
      ],

      queryFn: () =>
        api.get<{
          default_retention_days: number;
          account_deletion: string;
          audit_log_note: string;
        }>(
          '/privacy/retention',
        ),
    });

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    confirmation,
    setConfirmation,
  ] = useState('');

  const [dialog, setDialog] =
    useState(false);

  const del = useMutation({
    mutationFn: () =>
      api.delete(
        '/privacy/account',
        {
          confirmation,
          password:
            password || null,
        },
      ),

    onSuccess: () => {
      window.location.assign(
        '/',
      );
    },
  });


  async function exportData() {
    try {
      const response =
        await fetch(
          `${API_BASE}/privacy/export`,
          {
            credentials:
              'include',
          },
        );

      if (!response.ok) {
        throw new Error(
          'Export request failed',
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          'a',
        );

      anchor.href = url;

      anchor.download =
        'careerpilot-data-export.zip';

      anchor.click();

      URL.revokeObjectURL(
        url,
      );

      push(
        'Data export downloaded',
      );
    } catch (error) {
      push(
        err(error),
        'error',
      );
    }
  }


  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Data privacy"
        description="Review your data rights, consent history, retention information, export controls, and account deletion."
      />

      <SettingsNav active="privacy" />

      <section className="career-privacy-hero mb-5 overflow-hidden rounded-[22px] border border-emerald-500/15">
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div className="relative z-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-300">
              Data control
            </div>

            <h2 className="mt-3 text-24 font-semibold tracking-[-0.035em] md:text-28">
              Your career data should remain understandable and controllable.
            </h2>

            <p className="mt-3 max-w-2xl text-12 leading-6 text-text-secondary">
              Export your account data, review consent records, understand retention behavior, or permanently delete your account.
            </p>
          </div>

          <div className="relative z-10">
            <SettingsMiniMetric
              value="Private"
              label="career data"
              tone="positive"
            />
          </div>
        </div>
      </section>


      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="career-export-card overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex size-10 items-center justify-center rounded-[11px] border border-cyan-500/15 bg-cyan-500/10 text-cyan-400">
              <Download size={17} />
            </div>

            <h2 className="mt-4 text-15 font-semibold">
              Export your data
            </h2>

            <p className="mt-2 text-11 leading-5 text-text-secondary">
              Download a ZIP containing account data, profile, preferences, job matches, saved jobs, generated documents, applications, interview data, career analyses, notifications, and consent records.
            </p>

            <Button
              className="mt-5"
              variant="secondary"
              onClick={exportData}
            >
              <Download size={14} />
              Download export
            </Button>
          </div>
        </Panel>


        <Panel className="career-retention-card overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex size-10 items-center justify-center rounded-[11px] border border-emerald-500/15 bg-emerald-500/10 text-emerald-400">
              <Shield size={17} />
            </div>

            <h2 className="mt-4 text-15 font-semibold">
              Data retention
            </h2>

            {retention.isLoading ? (
              <Skeleton className="mt-4 h-20 rounded-[12px]" />
            ) : retention.error ? (
              <p className="mt-3 text-11 text-red-400">
                {err(retention.error)}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <PrivacyDetail
                  label="Default retention"
                  value={`${retention.data?.default_retention_days} days`}
                />

                <div className="rounded-[12px] border border-border bg-surface-2/45 p-3.5 text-[10px] leading-5 text-text-secondary">
                  {
                    retention.data
                      ?.audit_log_note
                  }
                </div>
              </div>
            )}
          </div>
        </Panel>


        <Panel className="overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-[10px] border border-indigo-500/15 bg-indigo-500/10 text-indigo-400">
                <ShieldCheck
                  size={15}
                />
              </div>

              <div>
                <h2 className="text-14 font-semibold">
                  Consent history
                </h2>

                <p className="mt-1 text-[10px] text-text-secondary">
                  Recorded consent decisions and policy versions associated with your account.
                </p>
              </div>
            </div>
          </div>


          {consents.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-24 rounded-[12px]" />
            </div>
          ) : consents.error ? (
            <p className="p-5 text-11 text-red-400">
              {err(consents.error)}
            </p>
          ) : !consents.data
              ?.length ? (
            <div className="p-5">
              <EmptyState
                title="No consent history"
                description="Consent records will appear here when recorded."
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {consents.data.map(
                (consent, index) => (
                  <ConsentRow
                    key={String(
                      consent.id ||
                        index,
                    )}
                    purpose={String(
                      consent.purpose ||
                        '',
                    )}
                    version={String(
                      consent.policy_version ||
                        '',
                    )}
                    granted={Boolean(
                      consent.granted,
                    )}
                    recordedAt={
                      consent.recorded_at
                    }
                  />
                ),
              )}
            </div>
          )}
        </Panel>


        <Panel className="career-danger-zone overflow-hidden border-red-500/20 lg:col-span-2">
          <div className="border-b border-red-500/10 bg-red-500/[0.035] px-5 py-5 md:px-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-red-500/10 text-red-400">
                <Trash2
                  size={17}
                />
              </div>

              <div>
                <h2 className="text-15 font-semibold text-red-400">
                  Delete account and data
                </h2>

                <p className="mt-1 max-w-2xl text-[10px] leading-5 text-text-secondary">
                  This action is destructive and cannot be reversed.
                </p>
              </div>
            </div>
          </div>


          <div className="grid gap-6 p-5 md:grid-cols-[1fr_360px] md:p-6">
            <div>
              <p className="max-w-2xl text-11 leading-6 text-text-secondary">
                Stored uploads are deleted from object storage and account-owned database records cascade. Security audit records may be retained only in de-identified form where required.
              </p>

              <div className="mt-4 rounded-[12px] border border-red-500/10 bg-red-500/[0.035] p-4">
                <div className="flex items-center gap-2 text-10 font-semibold text-red-400">
                  <CircleAlert
                    size={12}
                  />
                  Permanent action
                </div>

                <p className="mt-2 text-[10px] leading-5 text-text-secondary">
                  Export your data first if you want a copy before deletion.
                </p>
              </div>
            </div>


            <div className="space-y-4">
              <label className="block">
                <div className="mb-2 text-12 font-medium">
                  Type DELETE
                </div>

                <Input
                  className="h-11"
                  value={
                    confirmation
                  }
                  onChange={e =>
                    setConfirmation(
                      e.target.value,
                    )
                  }
                  placeholder="DELETE"
                />
              </label>


              {session.data?.user && (
                <label className="block">
                  <div className="mb-2 text-12 font-medium">
                    Current password
                    <span className="ml-1 font-normal text-text-secondary">
                      (local accounts)
                    </span>
                  </div>

                  <Input
                    className="h-11"
                    type="password"
                    value={password}
                    onChange={e =>
                      setPassword(
                        e.target.value,
                      )
                    }
                  />
                </label>
              )}


              <Button
                variant="danger"
                className="w-full"
                disabled={
                  confirmation !==
                  'DELETE'
                }
                onClick={() =>
                  setDialog(true)
                }
              >
                <Trash2 size={14} />
                Delete account
              </Button>


              {del.error && (
                <FieldError>
                  {err(del.error)}
                </FieldError>
              )}
            </div>
          </div>
        </Panel>
      </div>


      <ConfirmDialog
        open={dialog}
        danger
        title="Permanently delete this account?"
        description="This cannot be undone. Your CareerPilot account and candidate-owned data will be deleted."
        confirmLabel="Delete permanently"
        onClose={() =>
          setDialog(false)
        }
        onConfirm={() =>
          del.mutate()
        }
        busy={del.isPending}
      />
    </>
  );
}


/* =========================================================
   SMALL COMPONENTS
   ========================================================= */

function SettingsMiniMetric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone:
    | 'positive'
    | 'warning'
    | 'indigo'
    | 'cyan';
}) {
  const styles = {
    positive:
      'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400',
    warning:
      'border-amber-500/15 bg-amber-500/[0.06] text-amber-400',
    indigo:
      'border-indigo-500/15 bg-indigo-500/[0.06] text-indigo-400',
    cyan:
      'border-cyan-500/15 bg-cyan-500/[0.06] text-cyan-400',
  };

  return (
    <div
      className={`min-w-[100px] rounded-[13px] border p-3 text-right ${styles[tone]}`}
    >
      <div className="truncate text-16 font-semibold capitalize tracking-[-0.03em]">
        {value}
      </div>

      <div className="mt-1 text-[9px] text-text-secondary">
        {label}
      </div>
    </div>
  );
}


function AccountDetail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Mail;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-border bg-surface-2/45 p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-3 text-text-secondary">
        <Icon size={13} />
      </div>

      <div className="min-w-0">
        <div className="text-[10px] text-text-secondary">
          {label}
        </div>

        <div className="mt-1 truncate text-11 font-medium capitalize">
          {value}
        </div>
      </div>
    </div>
  );
}


function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-12 font-medium">
          {label}
        </span>

        {hint && (
          <span className="text-[9px] text-text-tertiary">
            {hint}
          </span>
        )}
      </div>

      <div className="relative">
        <Input
          className="h-11 pr-11"
          type={
            visible
              ? 'text'
              : 'password'
          }
          autoComplete={
            autoComplete
          }
          value={value}
          onChange={e =>
            onChange(
              e.target.value,
            )
          }
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary"
          aria-label={
            visible
              ? 'Hide password'
              : 'Show password'
          }
        >
          {visible ? (
            <EyeOff size={14} />
          ) : (
            <Eye size={14} />
          )}
        </button>
      </div>
    </label>
  );
}


function SettingsLinkCard({
  href,
  icon: Icon,
  title,
  description,
  color,
}: {
  href: string;
  icon: typeof Bell;
  title: string;
  description: string;
  color:
    | 'cyan'
    | 'emerald';
}) {
  const styles = {
    cyan:
      'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
    emerald:
      'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
  };

  return (
    <Link
      href={href}
      className="career-settings-link group rounded-[18px] border border-border bg-surface-1 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_16px_48px_rgba(0,0,0,.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex size-10 items-center justify-center rounded-[11px] border ${styles[color]}`}
        >
          <Icon size={16} />
        </div>

        <ArrowRight
          size={14}
          className="text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-indigo-400"
        />
      </div>

      <h2 className="mt-5 text-15 font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-11 leading-5 text-text-secondary">
        {description}
      </p>
    </Link>
  );
}


function NotificationToggle({
  title,
  description,
  icon: Icon,
  checked,
  onChange,
  accent = 'cyan',
}: {
  title: string;
  description: string;
  icon: typeof Bell;
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?:
    | 'cyan'
    | 'indigo'
    | 'emerald'
    | 'violet';
}) {
  const icons = {
    cyan:
      'bg-cyan-500/10 text-cyan-400',
    indigo:
      'bg-indigo-500/10 text-indigo-400',
    emerald:
      'bg-emerald-500/10 text-emerald-400',
    violet:
      'bg-violet-500/10 text-violet-400',
  };

  return (
    <button
      type="button"
      onClick={() =>
        onChange(!checked)
      }
      className={`flex w-full items-center justify-between gap-4 rounded-[14px] border p-4 text-left transition ${
        checked
          ? 'border-indigo-500/15 bg-indigo-500/[0.035]'
          : 'border-border bg-surface-2/40 hover:border-border-strong'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${icons[accent]}`}
        >
          <Icon size={14} />
        </div>

        <div>
          <div className="text-11 font-semibold">
            {title}
          </div>

          <p className="mt-1 text-[10px] leading-5 text-text-secondary">
            {description}
          </p>
        </div>
      </div>

      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked
            ? 'bg-indigo-500'
            : 'bg-surface-3'
        }`}
      >
        <span
          className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${
            checked
              ? 'left-6'
              : 'left-1'
          }`}
        />
      </span>
    </button>
  );
}


function NotificationCard({
  notification,
}: {
  notification: Notification;
}) {
  const unread =
    !notification.read_at;

  return (
    <Panel
      className={`career-notification-card overflow-hidden ${
        unread
          ? 'border-indigo-500/15'
          : ''
      }`}
    >
      <div className="flex items-start gap-4 p-4 md:p-5">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
            unread
              ? 'bg-indigo-500/10 text-indigo-400'
              : 'bg-surface-2 text-text-secondary'
          }`}
        >
          <Bell size={14} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-12 font-semibold">
              {notification.title}
            </div>

            {unread && (
              <span className="size-1.5 rounded-full bg-indigo-400" />
            )}

            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[8px] uppercase text-text-tertiary">
              {notification.channel}
            </span>
          </div>

          <p className="mt-2 text-11 leading-5 text-text-secondary">
            {notification.body}
          </p>
        </div>

        <span className="shrink-0 font-mono text-[9px] text-text-tertiary">
          {formatDate(
            notification.created_at,
          )}
        </span>
      </div>
    </Panel>
  );
}


function PrivacyDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-border bg-surface-2/45 p-3.5">
      <span className="text-10 text-text-secondary">
        {label}
      </span>

      <span className="font-mono text-10 font-medium">
        {value}
      </span>
    </div>
  );
}


function ConsentRow({
  purpose,
  version,
  granted,
  recordedAt,
}: {
  purpose: string;
  version: string;
  granted: boolean;
  recordedAt: unknown;
}) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1fr_120px_120px_150px] md:items-center md:px-6">
      <div>
        <div className="text-11 font-medium">
          {purpose || 'Consent'}
        </div>

        <div className="mt-1 text-[9px] text-text-tertiary md:hidden">
          Policy {version}
        </div>
      </div>

      <div className="hidden font-mono text-[9px] text-text-secondary md:block">
        {version || '—'}
      </div>

      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] ${
            granted
              ? 'border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-400'
              : 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400'
          }`}
        >
          {granted ? (
            <Check size={10} />
          ) : (
            <CircleAlert
              size={10}
            />
          )}

          {granted
            ? 'Granted'
            : 'Not granted'}
        </span>
      </div>

      <div className="font-mono text-[9px] text-text-tertiary">
        {formatDate(
          recordedAt,
        )}
      </div>
    </div>
  );
}


/* =========================================================
   LOADING
   ========================================================= */

function AccountLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[210px] rounded-[22px]" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-[330px] rounded-[20px]" />
        <Skeleton className="h-[430px] rounded-[20px]" />
      </div>
    </div>
  );
}


function NotificationsSettingsLoading() {
  return (
    <Skeleton className="h-[430px] rounded-[20px]" />
  );
}


function NotificationListLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(
        item => (
          <Skeleton
            key={item}
            className="h-[120px] rounded-[16px]"
          />
        ),
      )}
    </div>
  );
}
