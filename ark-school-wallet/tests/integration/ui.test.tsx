import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Header } from '../../src/components/common/Layout';
import { Lab } from '../../src/pages/Lab';
import { Send } from '../../src/pages/Send';
import { XRay } from '../../src/pages/XRay';
import { DemoWallet } from '../../src/lib/demo/DemoWallet';
import { DEMO_FRIEND_ADDRESS } from '../../src/lib/demo/fixtures';
import { useApp } from '../../src/state/store';

function at(path: string, route: string, el: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={el} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await act(async () => {
    await useApp.getState().closeWallet();
    useApp.setState({ lang: 'ja' });
  });
});

describe('UI', () => {
  it('header always shows SIGNET and the DEMO/LIVE mode', async () => {
    await act(async () => useApp.getState().startDemo(new DemoWallet('received', 0)));
    render(<MemoryRouter><Header /></MemoryRouter>);
    expect(screen.getByTestId('network-badge')).toHaveTextContent('SIGNET');
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('DEMO');
    act(() => useApp.setState({ mode: 'signet' }));
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('LIVE');
  });

  it('T13: X-Ray falls back to the concept view when the VTXO list is unavailable', async () => {
    const d = new DemoWallet('received', 0);
    await act(async () => useApp.getState().startDemo(d));
    act(() => useApp.setState((s) => ({ snapshot: { ...s.snapshot!, vtxos: [], vtxosUnavailable: true } })));
    at('/xray', '/xray', <XRay />);
    expect(screen.getByText('このSDKでは詳細を取得できません')).toBeInTheDocument();
    expect(screen.getAllByText(/概念図/).length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('vtxo-card')).toHaveLength(0);
  });

  it('T14: using the Lab never calls the wallet', async () => {
    const d = new DemoWallet('received', 0);
    await act(async () => useApp.getState().startDemo(d));
    const spies = ['sendArk', 'sync', 'getSnapshot', 'receive', 'refreshAll'].map((m) => vi.spyOn(d, m as never));
    at('/lab/1', '/lab/:lesson', <Lab />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('lesson1-step'));
    await user.click(screen.getByTestId('lesson1-step'));
    expect(screen.getByTestId('lab-banner')).toHaveTextContent('NO REAL PAYMENT');
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it('T08/T21: send needs explicit confirmation, and double-clicking confirm sends once', async () => {
    const d = new DemoWallet('received', 30);
    await act(async () => useApp.getState().startDemo(d));
    const send = vi.spyOn(d, 'sendArk');
    at('/send', '/send', <Send />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('送金先Arkアドレス'), DEMO_FRIEND_ADDRESS);
    await user.type(screen.getByLabelText('金額（sats・整数）'), '1000');
    await user.click(screen.getByTestId('review-send'));
    expect(send).not.toHaveBeenCalled(); // review only
    const confirm = await screen.findByTestId('confirm-send');
    await user.dblClick(confirm);
    await screen.findByTestId('snapshot-diff');
    expect(send).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId('diff-created')).getAllByRole('listitem')).toHaveLength(1);
  });
});
