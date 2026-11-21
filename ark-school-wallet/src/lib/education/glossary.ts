import type { L } from '../../i18n';

// Glossary content, kept apart from UI so it can be reviewed on its own
// (spec 6.2). Sources: Second's official docs, checked 2026-11-21.

export interface GlossaryTerm {
  id: string;
  term: L;
  quick: L;
  deep: L;
  sources: Array<{ label: string; url: string }>;
}

const D = 'https://second.tech/docs';

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: 'ark',
    term: { ja: 'Ark', en: 'Ark' },
    quick: { ja: 'Bitcoinのレイヤー2プロトコル。サーバーと協力して速く安く送金でき、いざとなれば自分だけでオンチェーンに戻れる（Exit）のが特徴です。', en: 'A Bitcoin layer 2 protocol. You pay fast and cheaply with a server\'s help, and can still get back on-chain on your own (exit) if needed.' },
    deep: { ja: 'Arkはクライアント・サーバー型。ユーザーの残高はVTXOとして表され、VTXOは事前署名済みのBitcoinトランザクション列で、一方的なExitが可能です。多くのユーザーが1つのオンチェーンUTXOを共有し、コストを分け合います。', en: 'Ark is client–server. Balances are VTXOs: chains of pre-signed Bitcoin transactions that allow a unilateral exit. Many users share one on-chain UTXO and split the cost.' },
    sources: [{ label: 'Intro to the Ark protocol', url: `${D}/learn/intro` }],
  },
  {
    id: 'asp',
    term: { ja: 'Arkサーバー（ASP）', en: 'Ark server (ASP)' },
    quick: { ja: '送金の共同署名やラウンドを運営するサーバー。資金を預かるのではなく、ユーザーと一緒に署名します。', en: 'The server that co-signs payments and runs rounds. It does not hold your funds; it signs together with you.' },
    deep: { ja: '通常の操作（送金・Refresh・Offboard）はサーバーとの協調署名が必要です。サーバーが協力しない場合の最終手段が緊急Exitです。期限切れのVTXOはサーバーがsweepできるため、期限前のRefreshが重要です。', en: 'Normal operations (payments, refresh, offboard) need a cooperative signature from the server. If it stops cooperating, the emergency exit is the last resort. The server can sweep expired VTXOs, so refreshing before expiry matters.' },
    sources: [{ label: 'Ark protocol glossary', url: `${D}/learn/glossary` }],
  },
  {
    id: 'vtxo',
    term: { ja: 'VTXO', en: 'VTXO' },
    quick: { ja: 'Arkの中で持っているBitcoinのかたまり。残高は、こうしたかたまりの合計から計算されます。', en: 'A chunk of bitcoin you hold inside Ark. Your balance is the sum of these chunks.' },
    deep: { ja: 'Virtual Transaction Output。オンチェーンUTXOそのものではなく、必要になればUTXOを作れる「事前署名済みトランザクションの列」です。種類はboard・refresh（ラウンド）・spend（arkoor）の3つで、信頼モデルとExitの長さ（exit depth）が違います。', en: 'Virtual Transaction Output. Not an on-chain UTXO itself, but a series of pre-signed transactions that can create one when needed. Three kinds — board, refresh (round) and spend (arkoor) — differ in trust model and exit length (exit depth).' },
    sources: [{ label: 'Ark VTXOs', url: `${D}/learn/vtxo` }],
  },
  {
    id: 'utxo',
    term: { ja: 'UTXO', en: 'UTXO' },
    quick: { ja: 'Bitcoinのブロックチェーン上にある「未使用の出力」。オンチェーンのお金の単位です。', en: 'An "unspent transaction output" on the Bitcoin blockchain: the unit of on-chain money.' },
    deep: { ja: 'Bitcoinの送金はUTXOを消費して新しいUTXOを作ります。VTXOも同じ「消費して作る」モデルですが、ブロックチェーンに書き込まれるのは必要なときだけです。', en: 'A Bitcoin payment consumes UTXOs and creates new ones. VTXOs follow the same consume-and-create model, but only touch the chain when needed.' },
    sources: [{ label: 'Ark VTXOs', url: `${D}/learn/vtxo` }],
  },
  {
    id: 'round',
    term: { ja: 'ラウンド', en: 'Round' },
    quick: { ja: 'サーバーが定期的に行う「まとめ処理」。古いVTXOを新しいVTXOに交換（Refresh）できます。', en: 'A periodic batch run by the server where old VTXOs are swapped for new ones (refresh).' },
    deep: { ja: 'ラウンドでは参加者のVTXOをforfeit（没収可能に署名）し、新しいトランザクションツリーをオンチェーンに1つ作ります。間隔はサーバー設定で、即時には終わりません。BarkにはWalletを常時起動しなくてよい「delegated refresh」もあります。', en: 'In a round, participants forfeit their VTXOs and a new transaction tree is anchored on-chain. The interval is server-configured and it does not finish instantly. Bark also supports delegated refreshes that do not need the wallet online throughout.' },
    sources: [{ label: 'Ark rounds', url: `${D}/learn/rounds` }, { label: 'Ark forfeits', url: `${D}/learn/forfeits` }],
  },
  {
    id: 'boarding',
    term: { ja: 'Boarding', en: 'Boarding' },
    quick: { ja: 'オンチェーンのBitcoinをArkに入れること。', en: 'Moving on-chain bitcoin into Ark.' },
    deep: { ja: 'Boardでできるboard VTXOは、ルートとリーフの2トランザクションの最も単純な構造で、作成後はトラストレスです。オンチェーンの承認待ちが必要です。', en: 'A board VTXO is the simplest structure (root + leaf, 2 transactions) and is trustless once created. It needs on-chain confirmations.' },
    sources: [{ label: 'Ark boarding', url: `${D}/learn/board` }],
  },
  {
    id: 'offboard',
    term: { ja: 'Offboard（協調的な引き出し）', en: 'Offboard (cooperative)' },
    quick: { ja: 'サーバーと協力してArkからオンチェーンに戻すこと。ふだんはこちらを使います。', en: 'Leaving Ark to an on-chain address with the server\'s cooperation. The normal way out.' },
    deep: { ja: 'サーバーが用意したトランザクションで、VTXOをオンチェーンのアドレスへ送ります。緊急Exitより効率的で安価です。このアプリでは学習のみで、実行は未対応です。', en: 'The server builds a transaction that pays your VTXOs to an on-chain address. More efficient and cheaper than an emergency exit. This app only teaches it; execution is not offered.' },
    sources: [{ label: 'Ark offboarding', url: `${D}/learn/offboard` }],
  },
  {
    id: 'refresh',
    term: { ja: 'Refresh', en: 'Refresh' },
    quick: { ja: '期限が近いVTXOを、ラウンドで新しいVTXOに交換すること。期限の数字をリセットするだけではありません。', en: 'Swapping a VTXO for a new one in a round before it expires. It is not just resetting a number.' },
    deep: { ja: '旧VTXOはラウンドで消費（forfeit）され、新しい寿命のVTXOが生まれます。受け取ったspend VTXOをrefresh VTXOに変えて信頼モデルを改善する目的もあります。費用はサーバーの手数料表（期限までの残りで変動）によります。', en: 'The old VTXO is forfeited in a round and a new one with a fresh lifetime is created. It also upgrades received spend VTXOs to the refresh trust model. The cost follows the server\'s fee schedule, which depends on remaining lifetime.' },
    sources: [{ label: 'VTXO lifetime', url: `${D}/learn/lifetime` }, { label: 'Ark fees', url: `${D}/learn/fees` }],
  },
  {
    id: 'arkoor',
    term: { ja: 'Arkoor（ラウンド外送金）', en: 'Arkoor (out-of-round)' },
    quick: { ja: 'ラウンドを待たずに即座に送るArkの送金方法。受け取るとspend VTXOになります。', en: 'Ark\'s instant payment method that does not wait for a round. You receive a spend VTXO.' },
    deep: { ja: 'spend VTXOは元のVTXOを延長した構造で、exit depthが1つ増えます。Refreshするまでは「送り手とサーバーが結託して二重払いしない」ことを信頼します（どちらかが誠実なら安全）。寿命は元のVTXOを引き継ぎます。', en: 'A spend VTXO extends its source VTXO, adding one to the exit depth. Until refreshed you trust that the sender and server do not collude to double-spend (safe if either is honest). It inherits the source VTXO\'s lifetime.' },
    sources: [{ label: 'Ark payments', url: `${D}/learn/payments` }],
  },
  {
    id: 'exit',
    term: { ja: '緊急Exit（一方的Exit）', en: 'Emergency exit (unilateral)' },
    quick: { ja: 'サーバーが協力しないときに、自分だけでBitcoinをオンチェーンに取り戻す最終手段。時間と手数料がかかります。', en: 'The last resort when the server will not cooperate: reclaim your bitcoin on-chain by yourself. It takes time and fees.' },
    deep: { ja: 'VTXOのツリーのトランザクションを根元から順に放送し、それぞれの承認を待ちます。最後のexitトランザクションの承認後、相対タイムロックを待ってclaimトランザクションで回収します。手数料（CPFP）のためのオンチェーン資金が必要で、期限前に完了する必要があります。', en: 'Broadcast the VTXO\'s tree transactions from the root down, waiting for each to confirm. After the final exit transaction confirms and its relative timelock passes, a claim transaction collects the funds. You need on-chain funds for fees (CPFP), and it must finish before expiry.' },
    sources: [{ label: 'Ark emergency exits', url: `${D}/learn/exit` }],
  },
  {
    id: 'exit-depth',
    term: { ja: 'Exit depth', en: 'Exit depth' },
    quick: { ja: 'Exitのために放送が必要なトランザクションの段数。深いほど時間と手数料がかかります。', en: 'How many transactions must be broadcast to exit. Deeper means more time and fees.' },
    deep: { ja: 'Bark SDKのVtxo.exitDepthはgenesis chainの長さです。サーバーのmaxVtxoExitDepthに近づくと、そのVTXOでのラウンド外送金をサーバーが拒否するため、Refreshが必要になります。', en: 'Bark\'s Vtxo.exitDepth is the genesis chain length. Near the server\'s maxVtxoExitDepth, the server refuses further out-of-round spends of that VTXO, so it needs a refresh.' },
    sources: [{ label: 'Ark VTXOs', url: `${D}/learn/vtxo` }],
  },
  {
    id: 'expiry',
    term: { ja: '期限（Expiry）', en: 'Expiry' },
    quick: { ja: 'VTXOには寿命があります。期限を過ぎると、Ark送金と緊急Exitはできなくなります。', en: 'VTXOs have a lifetime. After expiry, Ark payments and emergency exits are no longer possible.' },
    deep: { ja: 'Secondのサーバーではboard/refresh VTXOの寿命は28日（サーバー設定値）。期限後もRefresh・Lightning送金・Offboardはサーバーの協力があれば可能ですが、自力での回復手段はなくなります。「期限切れ＝即消失」ではありませんが、サーバー依存になります。', en: 'On Second\'s server, board/refresh VTXOs live 28 days (server-configured). After expiry, refresh, Lightning send and offboard are still possible with the server\'s cooperation, but you lose any unilateral remedy. Expired is not "instantly gone", but it becomes server-dependent.' },
    sources: [{ label: 'VTXO lifetime', url: `${D}/learn/lifetime` }],
  },
  {
    id: 'lightning',
    term: { ja: 'Lightningとの関係', en: 'Relationship to Lightning' },
    quick: { ja: 'ArkのウォレットからLightningの請求書を支払ったり、受け取ったりできます（このアプリのMVPでは未対応）。', en: 'An Ark wallet can pay and receive Lightning invoices (not in this app\'s MVP).' },
    deep: { ja: 'サーバーがLightningゲートウェイとなり、VTXOとHTLCを使って原子的に送受信します。Lightning受取で得るVTXOの寿命は短め（1〜3日）です。', en: 'The server acts as a Lightning gateway and settles atomically using VTXOs and HTLCs. VTXOs from Lightning receives have shorter lifetimes (1–3 days).' },
    sources: [{ label: 'Lightning payments', url: `${D}/learn/payments-lightning` }],
  },
  {
    id: 'trust',
    term: { ja: '信頼モデル（in-round / out-of-round）', en: 'Trust assumptions (in-round / out-of-round)' },
    quick: { ja: 'ラウンドで作られたVTXOはトラストレス。ラウンド外（arkoor）で受け取ったVTXOは、Refreshまで少しだけ信頼が必要です。', en: 'VTXOs created in a round are trustless. Out-of-round (arkoor) VTXOs need a little trust until refreshed.' },
    deep: { ja: 'arkoorで受け取ったspend VTXOは、送り手とサーバーの結託がなければ安全（ステートチェーンと同じモデル）。Refreshするとrefresh VTXOとなり標準の信頼モデルに戻ります。どのVTXOも期限前にRefreshされるため、この緩和は一時的です。', en: 'A spend VTXO received out-of-round is safe unless sender and server collude (the statechain model). Refreshing turns it into a refresh VTXO with the standard model. Since every VTXO must be refreshed before expiry, the relaxation is temporary.' },
    sources: [{ label: 'Ark payments', url: `${D}/learn/payments` }],
  },
  {
    id: 'seed-backup',
    term: { ja: '復元フレーズとDBバックアップ', en: 'Recovery phrase vs DB backup' },
    quick: { ja: '復元フレーズだけでは完全なバックアップではありません。履歴や進行中のExitは、ウォレットDBのバックアップがないと戻りません。', en: 'The recovery phrase alone is not a full backup. History and in-progress exits only come back from a wallet DB backup.' },
    deep: { ja: 'Barkはサーバー上のメールボックスにVTXOの記録を残し、復元フレーズでそれを取り戻して残高を再構築します。これはサーバーの協力に依存します。完全な独立復元には、状態変化ごとに暗号化したDBを端末外へ送る継続バックアップが必要です。', en: 'Bark keeps a record of your VTXOs in a server mailbox that the phrase can unlock to rebuild the balance. That depends on the server. A fully independent restore needs a continuous, encrypted DB backup shipped off-device after every state change.' },
    sources: [{ label: 'Backups', url: `${D}/backups` }],
  },
  {
    id: 'signet',
    term: { ja: 'Signet', en: 'Signet' },
    quick: { ja: 'Bitcoinのテスト用ネットワーク。コインに価値はありません。このアプリはSignet専用です。', en: 'A Bitcoin test network. Its coins have no value. This app is Signet-only.' },
    deep: { ja: 'Signetはブロック生成が署名者に管理されたテストネット。SecondはSignet用のArkサーバー（ark.signet.2nd.dev）・Esplora・faucetを公開しています。', en: 'Signet is a test network whose blocks are produced by designated signers. Second runs a Signet Ark server (ark.signet.2nd.dev), Esplora and a faucet.' },
    sources: [{ label: 'Connection details', url: `${D}/connection-details` }],
  },
];
