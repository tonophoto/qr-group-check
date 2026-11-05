# PR #11 ローカル検証記録 (2026-11-05)

判定: **ローカル検証 PASS / 本番再開 No-Go / Draft維持**。
対象: tonophoto/qr-group-check、feature/qr-shared-checks-20261103、起点16fda7abfbfe690e5113051feb69eb26ebd9368b。
既存checkoutの .firebaserc / .firebase/ を保護し、専用worktreeで作業した。

## 欠陥と修正

- 高: 同一roundのpointerメタデータ通知が子watchを解除し、同期が止まる。pointerのサーバー確認と子watchを分離し、同一IDなら購読を維持。
- 高: subscriptionエラー、offline、旅行・認証変更時に確認済み表示が残り得る。表示・監視・カメラを失効させ、古いコールバックと書込みを拒否。
- 高: ローカル重複判定がサーバーACKを経ず成功演出を呼ぶ。重複もtransactionで確認し、遅延ACKが別roundの成功にならないようにした。
- 高: 次回設定画面の開始ボタン状態が更新されず、開始できない。終了回と操作中状態を保持し、サーバー確定状態から有効性を再計算。
- 中: カメラ起動待ちと終了が競合する。起動Promiseを待って終了し、世代管理で古い処理による新カメラ終了を防止。
- 参加管理: 申請拒否UI、監視終了時の表示消去、停止/認証変更時の操作拒否を追加。承認はmember作成と申請削除のatomic batchを維持。
- build: 13ファイルallowlistを維持。生成先実パス確認、symlink入力/出力拒否を追加。

## 検証結果

2026-11-05 10:16:26 UTC (19:16 JST) の最終統合実行はexit 0。
詳細は [JSON証跡](../verification/local-results-2026-11-05.json)。

- JavaScript構文、静的テスト4/4、runtime回帰5/5、build 13資産、diff空白検査: PASS。
- 起点のgroup-sync.jsを同じruntimeテストで再現: 1 PASS / 4 FAIL。修正後5 PASS。
- Auth/Firestore/Storage Emulator: 15シナリオ群 PASS。teacher/admin、未登録、disabled、photographer、別旅行、service-admin単独、password認証、未ログインを検証。
- 独立クライアントA→B、同時登録new/duplicate/1件、ACK前成功なし、終了/再開/次回、最大14x8、offline/再接続、transaction直前の遠隔終了、同一batchの終了+check拒否: PASS。
- 実ブラウザ画面で申請→atomic承認→入場、拒否、無効化、初回権限失敗、teacher管理画面拒否、logout/アカウント/旅行変更: PASS。
- Node v24.22.1、SDK統合12.11.0、ブラウザは製品と同じCDN SDK10.14.1、Chromium149.0.7827.55。SDK依存更新は行っていない。
- ページ例外0、メディア終了警告0、外部送信0、不明なリクエスト拒否0。Firestoreの接続確認画像1件はローカルの1px画像で応答。

ブラウザではGoogle providerのAuth Emulator合成ユーザーを利用し、CDN資産を事前にローカル保存して配信した。製品のFirebase設定とimport URLはテストサーバーの応答内だけでdemo/localhostへ置換した。実Googleアカウントを使用していない。
カメラはChromium生成映像で実際のscanner.startを確認し、班コード入力は手動入力経路を自動検証した。実カメラでQRを読み取る検証、AQUOS wish2/wish5二台の検証は未実施。

## Rules候補と隔離

[Firestore候補](../verification/firestore.qr-only.rules) は完全default-denyの独立テスト資産。/qrTrips配下と/qrServiceAdmins本人getのみを限定し、写真・schools・chat・VoIP等は拒否。service adminであるだけでは旅行に入れない。
Google verified identity、active trip、enabled teacher/adminを要求。pointerとroundのatomic作成/正当な切替、限定状態遷移、checkのcreate-only、本人actor、server時刻、docID一致、groupCodes所属と設定範囲を独立検査する。終了後・偽pointer・不正フィールド・上書き・削除は拒否。
roundのgroupCodes全体をRulesで正規リスト生成する方式は評価式上限に達するため採用していない。配列数/重複を制限し、各checkを設定範囲でも検証する。クライアントは正規リストを生成する。
承認は申請のemail/displayNameと一致し、同一batchで申請削除が必要。自己昇格・別旅行の個人情報閲覧を拒否。[Storage候補](../verification/storage.deny.rules) は全面拒否。

テストはdemo-qr-pr11のみ。隔離profile、非実在ADC、metadata無効、Node socketのloopbackガード、JVM外向きproxy拒否、ブラウザroute/DNS制限を併用。Emulatorプロセスに本番資格情報を渡さない。Functionsは起動しない。
CLIの外向きMOTD失敗とJVMオプション表示警告はガード下のツール出力であり、テスト不合格や本番通信ではない。

## 公開物全件

- `app.js`
- `auth-gate.css`
- `auth-gate.js`
- `group-audio-fix.js`
- `group-effects.js`
- `group-sync.js`
- `index.html`
- `members.html`
- `members.js`
- `photography-effects.css`
- `photography-effects.js`
- `status.js`
- `style.css`

全件のサイズ/SHA256はJSON証跡に記録。HTML相対参照の存在も検査した。`.git/**`、`.firebaserc`、`firebase.json`、node_modules、開発スクリプト、テスト、データ、秘密情報ファイル、撮影画面は含まない。photography-effects.*は既存の表示演出のみで、写真管理/同期/Storageコードをロードしない。
firebase.jsonはpublic: dist-qr、target: qr-group-check。現在の本番siteID/Ruleset IDは今回再取得していない。過去の値を現在値と扱わず、deploy不可を維持。

## 再実行

既存のFirebase CLI、Java21、キャッシュ済みEmulator JAR、Firebase SDK、Playwright/Chromiumが必要。自動install/loginしない。既定パスはrunner先頭参照。QR_TEST_FIREBASE_CLI / QR_TEST_FIREBASE_ROOT / FIREBASE_EMULATORS_PATH / QR_TEST_BROWSER_ROOT / PLAYWRIGHT_BROWSERS_PATHで既存のローカル環境を指定可能。

```text
npm run test:qr:static
npm run test:qr:runtime
npm run build:qr
node scripts/prepare-qr-browser-cache.mjs
node scripts/run-qr-local-verification.mjs --browser
git diff --check
```

prepare段階だけは公開CDN静的JSを取得する。統合テストはlocalhostに隔離する。生成ログ/profile/SDKキャッシュ/distはGit対象外で、公開しない。runtimeのQR_VERIFY_BASELINE=1は固定起点SHAを再検査し、失敗することを期待する診断用。

## Git / Actions / 残作業

mainとPRブランチに追跡された.github workflowファイルはない。一方、GitHub管理APIの一覧ではdynamic/pages/pages-build-deploymentがactiveで1件存在し、直近履歴はmain起点。Pages配信元設定GETは404で確認不能だった。featureブランチpushによる非起動を断定できないため、指示書の条件に従って**pushせずローカルコミットで保全**。PR #11のremote headは起点SHAのまま、Draft未変更。Actionsの実行/再実行/dispatch、PR更新、mergeはしていない。
本番deploy/Rules/Auth/データ/サービス復旧は0。antidiscソースと既存PR #256/#263は変更していない。既存dirty checkoutは保護した。
権限を追加するクラウド/IAM操作はなし。worktreeへの書込みと必要なコマンドはCodex承認要求を使用。ローカル限定ブラウザ利用はユーザーが明示許可済み。Computer Useは不使用。

本番No-Goの残条件:

1. AQUOS二台/実Chrome/実カメラと実Googleログインの承認された検証。
2. 現在の本番Rulesetと正確なHosting siteID/target、Authドメインを読取確認。
3. 初期管理者・参加者運用とQR限定Rulesの独立レビュー。
4. 旧Hosting .git混入の安全判断（今回は調査範囲を拡大していない）。
5. 安全な切戻し資産の保全とQR限定再開の明示承認。旧Versionは復元しない。
6. Actions非起動条件を確認後にのみ既存PRブランチへ通常push。

antidisc側はschools/{schoolId}/trips/{tripId}/checkRounds/.../groupChecks/{groupId}で別系統。今回qrTripsの契約は維持し、自動コピー/二重書込み/統合実装はしない。将来の承認済みID・班・認証マッピングは[契約](qr-shared-sync-contract.md)参照。
