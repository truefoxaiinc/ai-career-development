'use client';

import Link from 'next/link';
import {
  FormEvent,
  ReactNode,
  useMemo,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { API_BASE, api } from '@/lib/api';
import { FieldError, Input, ThemeToggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import type { User } from '@/lib/types';


/* =========================================================
   TYPES
   ========================================================= */

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};


/* =========================================================
   SHARED AUTH SHELL
   ========================================================= */

function AuthShell({
  eyebrow = 'CareerPilot account',
  title,
  subtitle,
  children,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-text-primary">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="career-grid absolute inset-0 opacity-[0.36]" />

        <div className="career-orb career-orb-one opacity-70" />
        <div className="career-orb career-orb-two opacity-50" />
        <div className="career-orb-three opacity-50" />

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-canvas/20 to-canvas" />
      </div>

      {/* Top nav */}
      <header className="relative z-20">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-8 lg:px-10">
          <Link
            href="/"
            className="group flex items-center gap-2.5"
            aria-label="CareerPilot home"
          >
            <div className="flex size-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_8px_24px_rgba(79,70,229,.24)] transition-transform duration-300 group-hover:scale-[1.04]">
              <Sparkles size={16} strokeWidth={2} />
            </div>

            <span className="text-15 font-semibold tracking-[-0.025em]">
              CareerPilot
            </span>
          </Link>

          <ThemeToggle />
        </div>
      </header>

      {/* Main auth layout */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        {/* Left story panel */}
        <section className="hidden items-center px-10 pb-20 lg:flex xl:px-16">
          <div className="max-w-[590px] animate-enter">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/15 bg-indigo-500/[0.07] px-3 py-1.5 text-[11px] font-medium text-indigo-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              One profile for your entire job search
            </div>

            <h2 className="mt-7 max-w-[560px] text-[48px] font-semibold leading-[1.02] tracking-[-0.05em] xl:text-[58px]">
              Turn your experience into
              <span className="career-gradient-text block">
                your next opportunity.
              </span>
            </h2>

            <p className="mt-6 max-w-[510px] text-15 leading-7 text-text-secondary">
              Build a verified career profile once, then use it to discover
              better-fit jobs, tailor applications, and prepare for interviews.
            </p>

            {/* Product flow */}
            <div className="mt-10 space-y-3">
              <AuthFeature
                icon={<FileText size={16} />}
                title="Upload your CV once"
                copy="Extract experience, education, skills, and achievements."
                color="indigo"
              />

              <AuthFeature
                icon={<Globe2 size={16} />}
                title="Discover local and global roles"
                copy="Match your actual background against relevant opportunities."
                color="cyan"
              />

              <AuthFeature
                icon={<MessageSquare size={16} />}
                title="Prepare before the interview"
                copy="Build stronger answers from real career evidence."
                color="emerald"
              />
            </div>

            {/* Trust card */}
            <div className="mt-10 max-w-[510px] rounded-[18px] border border-border bg-surface-1/65 p-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-emerald-500/15 bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck size={17} />
                </div>

                <div>
                  <div className="text-12 font-semibold">
                    Grounded in your real experience
                  </div>

                  <div className="mt-1 text-[11px] leading-5 text-text-secondary">
                    CareerPilot helps strengthen your story without inventing
                    skills, roles, or achievements.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Auth panel */}
        <section className="flex items-start justify-center px-4 pb-14 pt-8 sm:px-6 md:items-center md:pb-20 md:pt-4 lg:px-10">
          <div className="animate-enter-delay w-full max-w-[470px]">
            <div className="auth-card relative overflow-hidden rounded-[24px] border border-border bg-surface-1/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:p-8">
              {/* top accent */}
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />

              <div className="mb-7 flex items-center justify-between lg:hidden">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-13 font-semibold"
                >
                  <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                    <Sparkles size={12} />
                  </div>

                  CareerPilot
                </Link>
              </div>

              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-indigo-400">
                {eyebrow}
              </div>

              <h1 className="mt-3 text-28 font-semibold tracking-[-0.035em] sm:text-[32px]">
                {title}
              </h1>

              <p className="mt-3 max-w-sm text-13 leading-6 text-text-secondary">
                {subtitle}
              </p>

              {children}
            </div>

            <p className="mt-5 text-center text-[11px] text-text-tertiary">
              Your career data stays connected to your CareerPilot workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}


/* =========================================================
   LOGIN
   ========================================================= */

export function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { push } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const out = await api.post<{
        user: User;
        email_verification_required: boolean;
      }>('/auth/login', {
        email: email.trim(),
        password,
      });

      if (out.email_verification_required) {
        router.push('/verify-email');
        return;
      }

      push('Logged in');

      const requestedNext = search.get('next');

      // Only permit local application routes.
      const next =
        requestedNext &&
        requestedNext.startsWith('/') &&
        !requestedNext.startsWith('//')
          ? requestedNext
          : '/dashboard/profile';

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function startOidc() {
    window.location.assign(`${API_BASE}/auth/oidc/start`);
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Continue your career search."
      subtitle="Log in to access your profile, job matches, applications, and interview preparation."
    >
      <button
        type="button"
        onClick={startOidc}
        disabled={busy}
        className="group mt-7 flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] border border-border-strong bg-surface-2 text-13 font-medium transition duration-200 hover:border-indigo-500/30 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BriefcaseBusiness
          size={16}
          className="text-text-secondary transition group-hover:text-indigo-400"
        />
        Continue with single sign-on
      </button>

      <AuthDivider />

      <form onSubmit={submit} noValidate className="space-y-5">
        <AuthField
          label="Email"
          icon={<Mail size={15} />}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 pl-10"
          />
        </AuthField>

        <AuthField
          label="Password"
          icon={<LockKeyhole size={15} />}
          trailing={
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-text-secondary transition hover:text-indigo-400"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            value={password}
            setValue={setPassword}
            visible={showPassword}
            setVisible={setShowPassword}
            autoComplete="current-password"
            disabled={busy}
          />
        </AuthField>

        {error && <AuthError>{error}</AuthError>}

        <PrimaryAuthButton busy={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </PrimaryAuthButton>
      </form>

      <div className="mt-7 border-t border-border pt-6 text-center text-12 text-text-secondary">
        New to CareerPilot?{' '}
        <Link
          href="/signup"
          className="font-semibold text-text-primary transition hover:text-indigo-400"
        >
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
}


/* =========================================================
   SIGNUP
   ========================================================= */

export function SignupPage() {
  const router = useRouter();
  const { push } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = useMemo(() => {
    let score = 0;

    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return score;
  }, [password]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    if (!terms || !privacy) {
      setError('Accept the Terms and Privacy Policy to continue.');
      return;
    }

    setBusy(true);

    try {
      const out = await api.post<{
        user: User;
        email_verification_required: boolean;
        dev_verification_token?: string;
      }>('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        accept_terms: terms,
        accept_privacy: privacy,
      });

      if (out.dev_verification_token) {
        await api.post('/auth/verify-email', {
          token: out.dev_verification_token,
        });

        push('Development account verified');
        router.push('/onboarding');
        return;
      }

      router.push('/verify-email');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Build your career profile."
      subtitle="Upload your experience once, then use it for job matching, tailored applications, and interview preparation."
    >
      <form onSubmit={submit} noValidate className="mt-7 space-y-5">
        <AuthField
          label="Full name"
          icon={<UserRound size={15} />}
        >
          <Input
            autoComplete="name"
            required
            placeholder="Your full name"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            className="h-12 pl-10"
          />
        </AuthField>

        <AuthField
          label="Email"
          icon={<Mail size={15} />}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 pl-10"
          />
        </AuthField>

        <AuthField
          label="Password"
          icon={<LockKeyhole size={15} />}
        >
          <PasswordInput
            value={password}
            setValue={setPassword}
            visible={showPassword}
            setVisible={setShowPassword}
            autoComplete="new-password"
            disabled={busy}
          />

          {password && (
            <PasswordStrength
              score={passwordStrength}
              validLength={password.length >= 10}
            />
          )}
        </AuthField>

        <div className="space-y-3 rounded-[13px] border border-border bg-surface-2/55 p-4">
          <ConsentCheckbox
            checked={terms}
            setChecked={setTerms}
            disabled={busy}
          >
            I accept the{' '}
            <Link
              href="/legal#terms"
              className="font-medium text-text-primary underline decoration-border-strong underline-offset-4 hover:text-indigo-400"
            >
              Terms
            </Link>
            .
          </ConsentCheckbox>

          <ConsentCheckbox
            checked={privacy}
            setChecked={setPrivacy}
            disabled={busy}
          >
            I accept the{' '}
            <Link
              href="/legal#privacy"
              className="font-medium text-text-primary underline decoration-border-strong underline-offset-4 hover:text-indigo-400"
            >
              Privacy Policy
            </Link>
            .
          </ConsentCheckbox>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <PrimaryAuthButton busy={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </PrimaryAuthButton>
      </form>

      <div className="mt-7 border-t border-border pt-6 text-center text-12 text-text-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-text-primary transition hover:text-indigo-400"
        >
          Log in
        </Link>
      </div>
    </AuthShell>
  );
}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');

  const [result, setResult] = useState<{
    message: string;
    dev_reset_token?: string;
  } | null>(null);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      setResult(
        await api.post('/auth/forgot-password', {
          email: email.trim(),
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password."
      subtitle="Enter your email and we'll send reset instructions if an account exists for that address."
    >
      {result ? (
        <div className="mt-7">
          <SuccessMessage title="Check your inbox">
            {result.message}
          </SuccessMessage>

          {result.dev_reset_token && (
            <Link
              href={`/reset-password?token=${encodeURIComponent(
                result.dev_reset_token,
              )}`}
              className="career-primary-button mt-5 flex h-11 items-center justify-center gap-2 rounded-[11px] px-4 text-13 font-medium text-white"
            >
              Use development reset token
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-7 space-y-5">
          <AuthField
            label="Email"
            icon={<Mail size={15} />}
          >
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@example.com"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
            />
          </AuthField>

          {error && <AuthError>{error}</AuthError>}

          <PrimaryAuthButton busy={busy}>
            {busy ? 'Sending…' : 'Send reset instructions'}
          </PrimaryAuthButton>
        </form>
      )}

      <AuthBackLink href="/login">
        Back to login
      </AuthBackLink>
    </AuthShell>
  );
}


/* =========================================================
   RESET PASSWORD
   ========================================================= */

export function ResetPasswordPage() {
  const search = useSearchParams();
  const router = useRouter();
  const { push } = useToast();

  const [token, setToken] = useState(search.get('token') || '');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();

    setError('');

    if (!token.trim()) {
      setError('Enter your reset token.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    setBusy(true);

    try {
      await api.post('/auth/reset-password', {
        token: token.trim(),
        new_password: password,
      });

      push('Password reset complete');
      router.push('/login');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password."
      subtitle="Create a new password for your CareerPilot account. Reset links expire and can only be used once."
    >
      <form onSubmit={submit} noValidate className="mt-7 space-y-5">
        <AuthField
          label="Reset token"
          icon={<ShieldCheck size={15} />}
        >
          <Input
            required
            value={token}
            disabled={busy}
            onChange={(e) => setToken(e.target.value)}
            className="h-12 pl-10 font-mono text-12"
            placeholder="Paste reset token"
          />
        </AuthField>

        <AuthField
          label="New password"
          icon={<LockKeyhole size={15} />}
        >
          <PasswordInput
            value={password}
            setValue={setPassword}
            visible={showPassword}
            setVisible={setShowPassword}
            autoComplete="new-password"
            disabled={busy}
          />

          <p className="mt-2 text-[11px] text-text-secondary">
            Use at least 10 characters.
          </p>
        </AuthField>

        {error && <AuthError>{error}</AuthError>}

        <PrimaryAuthButton busy={busy}>
          {busy ? 'Resetting…' : 'Reset password'}
        </PrimaryAuthButton>
      </form>

      <AuthBackLink href="/login">
        Back to login
      </AuthBackLink>
    </AuthShell>
  );
}


/* =========================================================
   VERIFY EMAIL
   ========================================================= */

export function VerifyEmailPage() {
  const search = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState(search.get('token') || '');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (!token.trim()) {
      setError('Enter your verification token.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await api.post('/auth/verify-email', {
        token: token.trim(),
      });

      router.push('/onboarding');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Verify your account"
      title="Check your email."
      subtitle="Open the verification link we sent you, or paste the verification token below."
    >
      <div className="mt-7 flex items-start gap-3 rounded-[13px] border border-indigo-500/15 bg-indigo-500/[0.06] p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
          <Mail size={15} />
        </div>

        <div>
          <div className="text-12 font-medium">
            Verification email sent
          </div>

          <p className="mt-1 text-[11px] leading-5 text-text-secondary">
            The verification link is time-sensitive. Check your spam folder if
            you do not see the message.
          </p>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="mt-5 space-y-5">
        <AuthField
          label="Verification token"
          icon={<ShieldCheck size={15} />}
        >
          <Input
            required
            value={token}
            disabled={busy}
            onChange={(e) => setToken(e.target.value)}
            className="h-12 pl-10 font-mono text-12"
            placeholder="Paste verification token"
          />
        </AuthField>

        {error && <AuthError>{error}</AuthError>}

        <PrimaryAuthButton busy={busy}>
          {busy ? 'Verifying…' : 'Verify email'}
        </PrimaryAuthButton>
      </form>
    </AuthShell>
  );
}


/* =========================================================
   SHARED COMPONENTS
   ========================================================= */

function AuthFeature({
  icon,
  title,
  copy,
  color,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  color: 'indigo' | 'cyan' | 'emerald';
}) {
  const colors = {
    indigo:
      'border-indigo-500/15 bg-indigo-500/[0.08] text-indigo-400',
    cyan:
      'border-cyan-500/15 bg-cyan-500/[0.08] text-cyan-400',
    emerald:
      'border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-400',
  };

  return (
    <div className="group flex max-w-[520px] items-start gap-4 rounded-[15px] border border-transparent p-3 transition duration-300 hover:border-border hover:bg-surface-1/45">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] border ${colors[color]}`}
      >
        {icon}
      </div>

      <div>
        <div className="text-12 font-semibold">
          {title}
        </div>

        <p className="mt-1 text-[11px] leading-5 text-text-secondary">
          {copy}
        </p>
      </div>
    </div>
  );
}


function AuthField({
  label,
  icon,
  trailing,
  children,
}: {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-12 font-medium text-text-primary">
          {label}
        </span>

        {trailing}
      </div>

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary">
            {icon}
          </div>
        )}

        {children}
      </div>
    </label>
  );
}


function PasswordInput({
  value,
  setValue,
  visible,
  setVisible,
  autoComplete,
  disabled,
}: {
  value: string;
  setValue: (value: string) => void;
  visible: boolean;
  setVisible: (value: boolean) => void;
  autoComplete: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary">
        <LockKeyhole size={15} />
      </div>

      <Input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        minLength={10}
        placeholder="••••••••••"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        className="h-12 pl-10 pr-11"
      />

      <button
        type="button"
        onClick={() => setVisible(!visible)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}


function PasswordStrength({
  score,
  validLength,
}: {
  score: number;
  validLength: boolean;
}) {
  const labels = [
    'Very weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
  ];

  return (
    <div className="mt-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((item) => (
          <span
            key={item}
            className={`h-1 flex-1 rounded-full transition-colors ${
              score >= item
                ? score <= 1
                  ? 'bg-red-400'
                  : score === 2
                    ? 'bg-amber-400'
                    : score === 3
                      ? 'bg-cyan-400'
                      : 'bg-emerald-400'
                : 'bg-surface-3'
            }`}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-text-secondary">
          {labels[score]}
        </span>

        <span
          className={
            validLength
              ? 'text-emerald-400'
              : 'text-text-secondary'
          }
        >
          {validLength ? '10+ characters ✓' : 'Minimum 10 characters'}
        </span>
      </div>
    </div>
  );
}


function ConsentCheckbox({
  checked,
  setChecked,
  disabled,
  children,
}: {
  checked: boolean;
  setChecked: (value: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-11 leading-5 text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => setChecked(e.target.checked)}
        className="peer sr-only"
      />

      <span
        className={`mt-0.5 flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border transition ${
          checked
            ? 'border-indigo-500 bg-indigo-500 text-white'
            : 'border-border-strong bg-canvas'
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>

      <span>{children}</span>
    </label>
  );
}


function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />

      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
        or continue with email
      </span>

      <span className="h-px flex-1 bg-border" />
    </div>
  );
}


function PrimaryAuthButton({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="career-primary-button group flex h-12 w-full items-center justify-center gap-2 rounded-[12px] px-5 text-13 font-semibold text-white transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {busy && <AuthSpinner />}

      {children}

      {!busy && (
        <ArrowRight
          size={14}
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}


function AuthSpinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
    />
  );
}


function AuthError({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-[11px] border border-red-500/15 bg-red-500/[0.07] p-3 text-11 leading-5 text-red-300"
    >
      <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-red-400" />

      <span>{children}</span>
    </div>
  );
}


function SuccessMessage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-emerald-500/15 bg-emerald-500/[0.07] p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 size={15} />
        </div>

        <div>
          <div className="text-12 font-semibold text-text-primary">
            {title}
          </div>

          <div className="mt-1 text-11 leading-5 text-text-secondary">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


function AuthBackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-7 border-t border-border pt-6 text-center">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-12 font-medium text-text-secondary transition hover:text-text-primary"
      >
        <ArrowRight size={12} className="rotate-180" />
        {children}
      </Link>
    </div>
  );
}


function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}