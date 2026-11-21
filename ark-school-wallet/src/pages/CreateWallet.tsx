import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../i18n/useT';
import { Button, Card, Field, Notice, PageTitle, inputClass } from '../components/common/ui';
import { generateMnemonic } from '../lib/bark/adapter';
import { requestPersistentStorage } from '../lib/security/environment';
import { MIN_PASSPHRASE_LENGTH } from '../lib/security/vault';
import { errorMessage } from '../lib/security/redact';
import { classifyOpenError, createWallet } from '../lib/session';

type Step = 'warn' | 'phrase' | 'quiz' | 'pass' | 'working';

function pickPositions(): [number, number, number] {
  const pool = Array.from({ length: 12 }, (_, i) => i);
  const out: number[] = [];
  const rnd = new Uint32Array(3);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < 3; i++) out.push(pool.splice(rnd[i]! % pool.length, 1)[0]!);
  return out.sort((a, b) => a - b) as [number, number, number];
}

export function PassphraseFields({ onSubmit, busy, submitLabel }: { onSubmit: (p: string) => void; busy: boolean; submitLabel: string }) {
  const t = useT();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (p1.length < MIN_PASSPHRASE_LENGTH) return setErr(t.create.passShort);
        if (p1 !== p2) return setErr(t.create.passMismatch);
        setErr(null);
        onSubmit(p1);
      }}
    >
      <Field id="pass1" label={t.create.pass}>
        <input id="pass1" type="password" autoComplete="new-password" className={inputClass} value={p1} onChange={(e) => setP1(e.target.value)} />
      </Field>
      <Field id="pass2" label={t.create.pass2} error={err}>
        <input id="pass2" type="password" autoComplete="new-password" className={inputClass} value={p2} onChange={(e) => setP2(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function CreateWallet() {
  const t = useT();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('warn');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState(['', '', '']);
  const [quizErr, setQuizErr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persist, setPersist] = useState<string | null>(null);
  const [positions] = useState(pickPositions);
  const words = mnemonic?.split(' ') ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle sub={t.common.testSats}>{t.create.title}</PageTitle>

      {step === 'warn' && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.create.warnTitle}</h2>
          <Notice tone="warn">{t.create.warn1}</Notice>
          <Notice tone="warn">{t.create.warn2}</Notice>
          <Notice tone="info">{t.create.warn3}</Notice>
          <Button
            variant="primary"
            onClick={async () => {
              try {
                setMnemonic(await generateMnemonic());
                setStep('phrase');
              } catch {
                setError(t.errors.wasm);
              }
            }}
          >
            {t.create.warnAck}
          </Button>
        </Card>
      )}

      {step === 'phrase' && mnemonic && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.create.phraseTitle}</h2>
          <p className="text-sm text-muted">{t.create.phraseLead}</p>
          {revealed ? (
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="mnemonic-words">
              {words.map((w, i) => (
                <li key={i} className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm">
                  <span className="mr-2 text-muted">{i + 1}.</span>
                  {w}
                </li>
              ))}
            </ol>
          ) : (
            <Button onClick={() => setRevealed(true)}>{t.create.reveal}</Button>
          )}
          {revealed && (
            <Button variant="primary" onClick={() => setStep('quiz')}>
              {t.create.written}
            </Button>
          )}
        </Card>
      )}

      {step === 'quiz' && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.create.quizTitle}</h2>
          <p className="text-sm text-muted">{t.create.quizLead(positions[0] + 1, positions[1] + 1, positions[2] + 1)}</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const ok = positions.every((p, i) => answers[i]!.trim().toLowerCase() === words[p]);
              setQuizErr(!ok);
              if (ok) setStep('pass');
            }}
          >
            {positions.map((p, i) => (
              <Field key={p} id={`quiz-${p}`} label={`#${p + 1}`}>
                <input
                  id={`quiz-${p}`}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={inputClass}
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </Field>
            ))}
            {quizErr && <Notice tone="danger">{t.create.quizWrong}</Notice>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep('phrase')}>
                {t.common.back}
              </Button>
              <Button type="submit" variant="primary">
                {t.common.next}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {(step === 'pass' || step === 'working') && mnemonic && (
        <Card className="space-y-3">
          <h2 className="font-bold">{t.create.passTitle}</h2>
          <p className="text-sm text-muted">{t.create.passLead}</p>
          <PassphraseFields
            busy={step === 'working'}
            submitLabel={step === 'working' ? t.create.creating : t.common.confirm}
            onSubmit={async (pass) => {
              setStep('working');
              setError(null);
              try {
                await createWallet(mnemonic, pass, 'created');
                const p = await requestPersistentStorage();
                setPersist(p === 'granted' ? t.create.persistGranted : t.create.persistDenied);
                setMnemonic(null);
                nav('/');
              } catch (err) {
                const kind = classifyOpenError(err);
                setError(`${kind === 'generic' || kind === 'bad-passphrase' ? t.errors.generic : t.errors[kind]} (${errorMessage(err)})`);
                setStep('pass');
              }
            }}
          />
          {step === 'working' && <p className="text-sm text-muted" role="status">{t.create.creating}</p>}
        </Card>
      )}

      {persist && <Notice tone="info">{persist}</Notice>}
      {error && (
        <Notice tone="danger" title={t.errors.generic}>
          {error}
        </Notice>
      )}
    </div>
  );
}
